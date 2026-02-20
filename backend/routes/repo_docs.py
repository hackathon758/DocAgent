"""
Repository Documentation routes - full-repo documentation generation via the
5-agent pipeline.  Extracted from server.py lines 2041-2553.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from typing import Dict, List, Any
import uuid
import re
import os
import logging

from database import db
from middleware.auth import get_current_user
from models import RepoDocumentationRequest
from websocket import ws_manager
from agents.orchestrator import orchestrator
from services.doc_service import fetch_github_repo_contents, generate_docx_from_documentation, generate_comprehensive_docx
from services.mermaid_utils import clean_mermaid_code
from services.section_assembler import assemble_sections
from config import GITHUB_TOKEN

logger = logging.getLogger(__name__)
repo_docs_router = APIRouter(prefix="/api/repo-documentation", tags=["Repository Documentation"])

# Store active documentation jobs with detailed progress
active_doc_jobs: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Background task – process every file through the 5-agent pipeline
# ---------------------------------------------------------------------------

async def process_repo_documentation(job_id: str, files: List[Dict[str, Any]], repo_url: str, branch: str, user_id: str, github_token: str = None, metadata_files: List[Dict[str, Any]] = None, test_files: List[Dict[str, Any]] = None, repository_id: str = None, tenant_id: str = None):
    """Process repository files through the 5-agent documentation pipeline.

    For each file the pipeline runs:
      1. Reader Agent    – analyzes code structure
      2. Searcher Agent  – gathers contextual information
      3. Writer Agent    – produces documentation draft
      4. Verifier Agent  – reviews and scores quality
      5. Diagram Agent   – generates visual diagrams

    After all files are processed, a 6th synthesis step assembles
    19 project-level documentation sections.

    Progress is tracked per-file and per-agent and broadcast via WebSocket.
    """
    if metadata_files is None:
        metadata_files = []
    if test_files is None:
        test_files = []
    job = active_doc_jobs.get(job_id)
    if not job:
        logger.error(f"Job {job_id} not found in active_doc_jobs")
        return

    total_files = len(files)
    job["total_files"] = total_files
    job["status"] = "processing"

    # Build file contents map for comprehensive DOCX export
    file_contents_map = {f.get("path", ""): f.get("content", "") for f in files}
    job["file_contents_map"] = file_contents_map

    agents = ["reader", "searcher", "writer", "verifier", "diagram"]

    try:
        for file_idx, file_info in enumerate(files):
            file_path = file_info.get("path", "unknown")
            file_content = file_info.get("content", "")

            job["current_file"] = file_path
            job["current_file_index"] = file_idx
            job["files_completed"] = file_idx
            job["progress"] = round((file_idx / total_files) * 100, 2) if total_files > 0 else 0

            file_result = {
                "path": file_path,
                "content": file_content,
                "status": "processing",
                "agents": {},
                "documentation": None,
            }
            job["file_results"].append(file_result)

            # Broadcast file-level progress
            await ws_manager.broadcast(
                {
                    "type": "repo_doc_progress",
                    "job_id": job_id,
                    "file": file_path,
                    "file_index": file_idx,
                    "total_files": total_files,
                    "progress": job["progress"],
                    "status": "processing_file",
                }
            )

            # Run each agent in sequence
            agent_outputs: Dict[str, Any] = {}
            for agent_name in agents:
                file_result["agents"][agent_name] = {"status": "running", "started_at": datetime.now(timezone.utc).isoformat()}

                await ws_manager.broadcast(
                    {
                        "type": "repo_doc_agent_progress",
                        "job_id": job_id,
                        "file": file_path,
                        "file_index": file_idx,
                        "total_files": total_files,
                        "files_completed": file_idx,
                        "agent": agent_name,
                        "status": "running",
                    }
                )

                try:
                    agent_output = await orchestrator.run_agent(
                        agent_name=agent_name,
                        file_path=file_path,
                        file_content=file_content,
                        repo_url=repo_url,
                        branch=branch,
                        previous_outputs=agent_outputs,
                    )
                    agent_outputs[agent_name] = agent_output
                    file_result["agents"][agent_name].update(
                        {
                            "status": "completed",
                            "completed_at": datetime.now(timezone.utc).isoformat(),
                            "output": agent_output,
                        }
                    )

                    await ws_manager.broadcast(
                        {
                            "type": "repo_doc_agent_progress",
                            "job_id": job_id,
                            "file": file_path,
                            "file_index": file_idx,
                            "total_files": total_files,
                            "files_completed": file_idx,
                            "agent": agent_name,
                            "status": "completed",
                        }
                    )

                except Exception as agent_err:
                    logger.error(f"Agent '{agent_name}' failed for {file_path}: {agent_err}")
                    file_result["agents"][agent_name].update(
                        {
                            "status": "error",
                            "error": str(agent_err),
                            "completed_at": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                    await ws_manager.broadcast(
                        {
                            "type": "repo_doc_agent_progress",
                            "job_id": job_id,
                            "file": file_path,
                            "file_index": file_idx,
                            "total_files": total_files,
                            "files_completed": file_idx,
                            "agent": agent_name,
                            "status": "error",
                            "error": str(agent_err),
                        }
                    )
                    # Continue with remaining agents even if one fails

            # Capture final documentation for the file
            file_result["documentation"] = agent_outputs.get("writer") or agent_outputs.get("diagram")
            file_result["status"] = "completed"

        # All files processed — now synthesize project-level sections
        await ws_manager.broadcast(
            {
                "type": "repo_doc_progress",
                "job_id": job_id,
                "status": "synthesizing",
                "progress": 95,
                "total_files": total_files,
                "message": "Assembling project-level documentation sections...",
            }
        )

        repo_name = repo_url.rstrip("/").split("/")[-1] if repo_url else "repository"
        try:
            sections = await assemble_sections(
                repo_name=repo_name,
                repo_url=repo_url,
                branch=branch,
                file_results=job["file_results"],
                metadata_files=metadata_files,
                test_files=test_files,
            )
            job["sections"] = sections
        except Exception as synth_err:
            logger.error(f"Section assembly failed for job {job_id}: {synth_err}")
            job["sections"] = []

        job["status"] = "completed"
        job["files_completed"] = total_files
        job["progress"] = 100
        job["completed_at"] = datetime.now(timezone.utc).isoformat()

        # Persist to database (strip file content to avoid bloat)
        try:
            db_file_results = [
                {k: v for k, v in fr.items() if k != "content"}
                for fr in job["file_results"]
            ]
            await db.repo_documentation.insert_one(
                {
                    "job_id": job_id,
                    "repo_url": repo_url,
                    "branch": branch,
                    "user_id": user_id,
                    "status": "completed",
                    "total_files": total_files,
                    "file_results": db_file_results,
                    "sections": job.get("sections", []),
                    "created_at": job.get("created_at"),
                    "completed_at": job["completed_at"],
                }
            )
        except Exception as db_err:
            logger.error(f"Failed to persist job {job_id}: {db_err}")

        # Write individual documentation records to db.documentation
        # so they appear on the Documentation page linked to the repository
        if repository_id and tenant_id:
            try:
                docs_for_db = _build_docs_for_export(job["file_results"])
                now_str = datetime.now(timezone.utc).isoformat()

                for idx, doc_data in enumerate(docs_for_db):
                    component_path = doc_data.get("component_path", "")

                    # Get source code from the in-memory file results
                    source_code = ""
                    if idx < len(job["file_results"]):
                        source_code = job["file_results"][idx].get("content", "")

                    doc_record = {
                        "id": str(uuid.uuid4()),
                        "tenant_id": tenant_id,
                        "repository_id": repository_id,
                        "component_path": component_path,
                        "source_code": source_code,
                        "language": doc_data.get("language", "text"),
                        "style": "google",
                        "docstring": doc_data.get("docstring", ""),
                        "markdown": doc_data.get("markdown", ""),
                        "metadata": {
                            "quality_score": doc_data.get("quality_score", 0),
                            "examples": (doc_data.get("usage_example", "").split("\n")
                                         if doc_data.get("usage_example") else []),
                            "diagram": doc_data.get("diagram"),
                        },
                        "diagrams": doc_data.get("diagrams", []),
                        "version": 1,
                        "created_at": now_str,
                        "updated_at": now_str,
                    }

                    # Upsert: update if doc for this component already exists in this repo
                    existing = await db.documentation.find_one({
                        "tenant_id": tenant_id,
                        "repository_id": repository_id,
                        "component_path": component_path,
                    })

                    if existing:
                        doc_record["id"] = existing["id"]
                        doc_record["version"] = existing.get("version", 1) + 1
                        await db.documentation.update_one(
                            {"id": existing["id"], "tenant_id": tenant_id},
                            {"$set": doc_record},
                        )
                    else:
                        await db.documentation.insert_one(doc_record)

            except Exception as doc_db_err:
                logger.error(f"Failed to write documentation records for job {job_id}: {doc_db_err}")

            # Update repository status and stats
            try:
                await db.repositories.update_one(
                    {"id": repository_id, "tenant_id": tenant_id},
                    {"$set": {
                        "status": "synced",
                        "components_count": total_files,
                        "last_synced_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }}
                )
            except Exception as repo_update_err:
                logger.error(f"Failed to update repository {repository_id}: {repo_update_err}")

        await ws_manager.broadcast(
            {
                "type": "repo_doc_progress",
                "job_id": job_id,
                "status": "completed",
                "progress": 100,
                "total_files": total_files,
            }
        )

    except Exception as exc:
        logger.error(f"Documentation job {job_id} failed: {exc}")
        job["status"] = "error"
        job["error"] = str(exc)
        await ws_manager.broadcast(
            {
                "type": "repo_doc_progress",
                "job_id": job_id,
                "status": "error",
                "error": str(exc),
            }
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_docs_for_export(file_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Transform raw file_results into the doc list expected by
    generate_docx_from_documentation and the frontend preview modal."""
    docs = []
    for fr in file_results:
        file_path = fr.get("path", "unknown")
        agents_out = fr.get("agents", {})

        # Extract agent outputs (stored as dicts with 'output' key)
        def _get_agent_output(agent_name):
            data = agents_out.get(agent_name, {})
            if isinstance(data, dict):
                return data.get("output", data.get("output_preview", ""))
            return ""

        writer_output = _get_agent_output("writer")
        reader_output = _get_agent_output("reader")
        verifier_output = _get_agent_output("verifier")
        diagram_output = _get_agent_output("diagram")

        import json as _json

        docstring = ""
        markdown = ""
        examples = []
        quality_score = 0
        diagram_code = ""
        complexity = ""

        # Parse writer output
        try:
            w = writer_output if isinstance(writer_output, dict) else (_json.loads(writer_output) if isinstance(writer_output, str) and writer_output.strip() else {})
            docstring = w.get("docstring", "")
            markdown = w.get("markdown", "")
            examples = w.get("examples", [])
        except Exception:
            docstring = str(writer_output)[:1000] if writer_output else ""

        # Parse verifier output
        try:
            v = verifier_output if isinstance(verifier_output, dict) else (_json.loads(verifier_output) if isinstance(verifier_output, str) and verifier_output.strip() else {})
            quality_score = v.get("quality_score", 0)
        except Exception:
            quality_score = 0

        # Parse diagram output
        diagram_description = "Auto-generated diagram"
        try:
            d = diagram_output if isinstance(diagram_output, dict) else (_json.loads(diagram_output) if isinstance(diagram_output, str) and diagram_output.strip() else {})
            diagram_code = d.get("mermaid_code") or d.get("code") or d.get("diagram") or d.get("mermaid") or ""
            diagram_description = d.get("description") or diagram_description
        except Exception as e:
            logger.warning(f"Failed to parse diagram output for {file_path}: {e} — raw: {str(diagram_output)[:300]}")

        # Clean extracted diagram code
        if diagram_code:
            diagram_code = clean_mermaid_code(diagram_code)
            logger.info(f"Diagram extracted for {file_path}: {len(diagram_code)} chars")
        else:
            logger.debug(f"No diagram extracted for {file_path}")

        # Parse reader for complexity
        try:
            r = reader_output if isinstance(reader_output, dict) else (_json.loads(reader_output) if isinstance(reader_output, str) and reader_output.strip() else {})
            c = r.get("complexity", {})
            if isinstance(c, dict):
                complexity = f"Cyclomatic: {c.get('cyclomatic', 'N/A')}, Cognitive: {c.get('cognitive', 'N/A')}"
        except Exception:
            pass

        # Detect language from extension
        import os as _os
        ext = _os.path.splitext(file_path)[1].lower()
        lang_map = {
            '.py': 'python', '.js': 'javascript', '.jsx': 'javascript',
            '.ts': 'typescript', '.tsx': 'typescript', '.java': 'java',
            '.cpp': 'cpp', '.c': 'c', '.h': 'c', '.go': 'go',
            '.rs': 'rust', '.cs': 'csharp', '.rb': 'ruby', '.php': 'php'
        }
        language = lang_map.get(ext, 'text')

        # Use the raw documentation field if agents didn't produce structured output
        raw_doc = fr.get("documentation")
        if not docstring and raw_doc:
            if isinstance(raw_doc, dict):
                docstring = raw_doc.get("docstring", raw_doc.get("markdown", str(raw_doc)))
                markdown = raw_doc.get("markdown", "")
                quality_score = raw_doc.get("quality_score", quality_score)
            elif isinstance(raw_doc, str):
                docstring = raw_doc[:2000]

        docs.append({
            "component_path": file_path,
            "language": language,
            "component_type": "module",
            "quality_score": quality_score,
            "docstring": docstring,
            "markdown": markdown,
            "usage_example": "\n".join(examples) if examples else "",
            "diagram": diagram_code,
            "complexity": complexity,
            "diagrams": [{"mermaid_code": diagram_code, "description": diagram_description}] if diagram_code else [],
        })
    return docs


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@repo_docs_router.post("/start")
async def start_repo_documentation(
    request: RepoDocumentationRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Start full repository documentation generation.

    1. Fetches all files from the GitHub repository.
    2. Filters files by supported extensions.
    3. Kicks off background processing through the 5-agent pipeline.
    """
    repo_url = request.repo_url
    branch = request.branch if hasattr(request, "branch") and request.branch else "main"
    user_id = current_user.get("user_id", current_user.get("id", "anonymous"))
    tenant_id = current_user.get("tenant_id")

    # Validate URL
    if not repo_url or not re.match(r"https?://github\.com/.+/.+", repo_url):
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")

    job_id = str(uuid.uuid4())

    # Fetch repository contents
    # Prefer user-provided OAuth token, fall back to server-wide GITHUB_TOKEN
    access_token = request.github_token or GITHUB_TOKEN or None

    try:
        repo_data = await fetch_github_repo_contents(repo_url, branch, access_token=access_token)
    except Exception as e:
        logger.error(f"Failed to fetch repo contents: {e}")
        raise HTTPException(status_code=502, detail=f"Could not fetch repository contents: {e}")

    files = repo_data.get("files", [])
    metadata_files = repo_data.get("metadata_files", [])
    test_files = repo_data.get("test_files", [])

    if not files:
        raise HTTPException(status_code=404, detail="No processable files found in the repository")

    # Limit files to avoid overloading (max 50 files)
    MAX_FILES = 50
    if len(files) > MAX_FILES:
        logger.info(f"Limiting from {len(files)} to {MAX_FILES} files")
        files = files[:MAX_FILES]

    # Create or find repository record in db.repositories
    repository_id = None
    if tenant_id:
        existing_repo = await db.repositories.find_one({
            "tenant_id": tenant_id,
            "repo_url": repo_url,
        })

        if existing_repo:
            repository_id = existing_repo["id"]
            await db.repositories.update_one(
                {"id": repository_id, "tenant_id": tenant_id},
                {"$set": {
                    "status": "processing",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }}
            )
        else:
            repository_id = str(uuid.uuid4())
            repo_name = repo_url.rstrip("/").split("/")[-1]

            # Detect dominant language from file extensions
            ext_to_lang = {
                '.py': 'python', '.js': 'javascript', '.jsx': 'javascript',
                '.ts': 'typescript', '.tsx': 'typescript', '.java': 'java',
                '.go': 'go', '.rs': 'rust', '.cpp': 'cpp', '.c': 'c',
                '.cs': 'csharp', '.rb': 'ruby', '.php': 'php',
            }
            lang_counts = {}
            for f in files:
                ext = os.path.splitext(f.get("path", ""))[1].lower()
                lang = ext_to_lang.get(ext, "text")
                lang_counts[lang] = lang_counts.get(lang, 0) + 1
            dominant_language = max(lang_counts, key=lang_counts.get) if lang_counts else "python"

            now_repo = datetime.now(timezone.utc).isoformat()
            repository = {
                "id": repository_id,
                "tenant_id": tenant_id,
                "name": repo_name,
                "repo_url": repo_url,
                "provider": "github",
                "branch": branch,
                "language": dominant_language,
                "status": "processing",
                "components_count": len(files),
                "coverage_percentage": 0.0,
                "last_synced_at": None,
                "webhook_url": None,
                "created_at": now_repo,
                "updated_at": now_repo,
                "created_by": user_id,
            }
            await db.repositories.insert_one(repository)

    # Initialise job tracking
    now = datetime.now(timezone.utc).isoformat()
    active_doc_jobs[job_id] = {
        "job_id": job_id,
        "repo_url": repo_url,
        "branch": branch,
        "user_id": user_id,
        "status": "starting",
        "total_files": len(files),
        "files_completed": 0,
        "current_file": None,
        "current_file_index": 0,
        "progress": 0,
        "file_results": [],
        "error": None,
        "created_at": now,
        "completed_at": None,
    }

    # Fire and forget
    background_tasks.add_task(process_repo_documentation, job_id, files, repo_url, branch, user_id, access_token, metadata_files, test_files, repository_id, tenant_id)

    return {
        "job_id": job_id,
        "repository_id": repository_id,
        "status": "starting",
        "total_files": len(files),
        "repo_url": repo_url,
        "branch": branch,
        "message": f"Documentation generation started for {len(files)} files",
    }


@repo_docs_router.get("/status/{job_id}")
async def get_job_status(job_id: str, current_user: dict = Depends(get_current_user)):
    """Get documentation job status with per-agent progress detail."""
    job = active_doc_jobs.get(job_id)

    if not job:
        # Try database
        try:
            db_job = await db.repo_documentation.find_one({"job_id": job_id})
            if db_job:
                db_job.pop("_id", None)
                return db_job
        except Exception:
            pass
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    # Derive repo_name from URL
    repo_name = job["repo_url"].rstrip("/").split("/")[-1] if job.get("repo_url") else "repository"

    # Aggregate per-agent progress across all processed files
    agent_names = ["reader", "searcher", "writer", "verifier", "diagram"]
    file_results = job.get("file_results", [])
    total_files = max(job.get("total_files", 1), 1)
    files_processed = job.get("files_completed", 0)

    agents_summary = {}
    current_agent = None
    for ag in agent_names:
        completed_count = 0
        is_running = False
        for fr in file_results:
            agent_info = fr.get("agents", {}).get(ag, {})
            st = agent_info.get("status", "pending")
            if st == "completed" or st == "error":
                completed_count += 1
            elif st == "running":
                is_running = True

        if completed_count >= total_files:
            agent_status = "completed"
            agent_progress = 100
        elif is_running or completed_count > 0:
            agent_status = "processing"
            agent_progress = round((completed_count / total_files) * 100)
            if current_agent is None:
                current_agent = ag
        else:
            agent_status = "pending"
            agent_progress = 0

        agents_summary[ag] = {"status": agent_status, "progress": agent_progress}

    overall_progress = job.get("progress", 0)
    if job["status"] == "completed":
        overall_progress = 100
        for ag in agent_names:
            agents_summary[ag] = {"status": "completed", "progress": 100}

    return {
        "job_id": job["job_id"],
        "repo_url": job["repo_url"],
        "repo_name": repo_name,
        "branch": job["branch"],
        "status": job["status"],
        "total_files": job["total_files"],
        "files_processed": files_processed,
        "files_completed": job["files_completed"],
        "overall_progress": overall_progress,
        "progress": job["progress"],
        "agents": agents_summary,
        "current_agent": current_agent,
        "error": job.get("error"),
        "created_at": job.get("created_at"),
        "completed_at": job.get("completed_at"),
    }


@repo_docs_router.get("/export/{job_id}")
async def export_documentation(job_id: str, current_user: dict = Depends(get_current_user)):
    """Export completed documentation as a DOCX file."""
    job = active_doc_jobs.get(job_id)

    if not job:
        try:
            job = await db.repo_documentation.find_one({"job_id": job_id})
            if job:
                job.pop("_id", None)
        except Exception:
            pass

    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    if job.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job is not yet completed (current status: {job.get('status')})",
        )

    file_results = job.get("file_results", [])
    if not file_results:
        raise HTTPException(status_code=400, detail="No documentation results available for export")

    # Build docs list in the shape the exporter expects
    docs_for_export = _build_docs_for_export(file_results)
    repo_name = job.get("repo_url", "repo").rstrip("/").split("/")[-1] or "documentation"
    repo_url = job.get("repo_url", "")
    branch = job.get("branch", "main")
    file_contents_map = job.get("file_contents_map", {})

    try:
        docx_buffer = generate_comprehensive_docx(
            docs_for_export,
            repo_name,
            repo_url=repo_url,
            branch=branch,
            file_contents=file_contents_map,
        )
    except Exception as e:
        logger.error(f"DOCX generation failed for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate DOCX: {e}")

    filename = f"{repo_name}-documentation.docx"

    return StreamingResponse(
        docx_buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@repo_docs_router.get("/preview/{job_id}")
async def preview_documentation(job_id: str, current_user: dict = Depends(get_current_user)):
    """Get a consolidated documentation preview for the repository."""
    job = active_doc_jobs.get(job_id)

    if not job:
        try:
            job = await db.repo_documentation.find_one({"job_id": job_id})
            if job:
                job.pop("_id", None)
        except Exception:
            pass

    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    repo_name = job.get("repo_url", "repo").rstrip("/").split("/")[-1] or "repository"

    # Use pre-assembled 19-section structure if available
    pre_sections = job.get("sections")
    if pre_sections:
        # Compute summary from sections
        file_results = job.get("file_results", [])
        per_file_docs = _build_docs_for_export(file_results)
        languages = {}
        total_quality = 0
        quality_count = 0
        all_diagrams = []
        for doc in per_file_docs:
            lang = doc.get("language", "text")
            languages[lang] = languages.get(lang, 0) + 1
            if doc.get("quality_score"):
                total_quality += doc["quality_score"]
                quality_count += 1
            if doc.get("diagram"):
                all_diagrams.append({"code": doc["diagram"], "source": doc.get("component_path", "")})
        avg_quality = round(total_quality / quality_count) if quality_count else 0

        return {
            "job_id": job_id,
            "repo_url": job.get("repo_url"),
            "repo_name": repo_name,
            "branch": job.get("branch"),
            "status": job.get("status"),
            "total_files": job.get("total_files", len(file_results)),
            "sections": pre_sections,
            "summary": {
                "total_files": len(per_file_docs),
                "languages": languages,
                "average_quality": avg_quality,
                "total_diagrams": len(all_diagrams),
            },
        }

    # Fallback: build sections from per-file results (backward compatibility)
    file_results = job.get("file_results", [])
    per_file_docs = _build_docs_for_export(file_results)

    # Build consolidated documentation sections
    sections = []

    # 1. Overview section
    languages = {}
    total_quality = 0
    quality_count = 0
    all_diagrams = []
    for doc in per_file_docs:
        lang = doc.get("language", "text")
        languages[lang] = languages.get(lang, 0) + 1
        if doc.get("quality_score"):
            total_quality += doc["quality_score"]
            quality_count += 1
        if doc.get("diagram"):
            all_diagrams.append({"code": doc["diagram"], "source": doc.get("component_path", "")})

    avg_quality = round(total_quality / quality_count) if quality_count else 0
    lang_summary = ", ".join(f"{lang} ({count})" for lang, count in sorted(languages.items(), key=lambda x: -x[1]))

    sections.append({
        "title": "Project Overview",
        "type": "overview",
        "content": f"This documentation covers {len(per_file_docs)} source files in the **{repo_name}** repository.\n\n"
                   f"**Languages:** {lang_summary}\n\n"
                   f"**Average Quality Score:** {avg_quality}%\n\n"
                   f"**Total Diagrams Generated:** {len(all_diagrams)}",
        "quality_score": avg_quality,
    })

    # 2. Group files by directory/module for a cleaner view
    modules = {}
    for doc in per_file_docs:
        path = doc.get("component_path", "unknown")
        parts = path.replace("\\", "/").split("/")
        module = parts[0] if len(parts) > 1 else "(root)"
        if module not in modules:
            modules[module] = []
        modules[module].append(doc)

    for module_name, module_docs in sorted(modules.items()):
        # Merge documentation from all files in this module
        merged_docstrings = []
        merged_diagrams = []
        module_quality = 0
        module_quality_count = 0
        module_languages = set()

        for doc in module_docs:
            if doc.get("docstring"):
                merged_docstrings.append(f"### {doc.get('component_path', '')}\n\n{doc['docstring']}")
            if doc.get("markdown"):
                merged_docstrings.append(doc["markdown"])
            if doc.get("diagram"):
                merged_diagrams.append(doc["diagram"])
            if doc.get("quality_score"):
                module_quality += doc["quality_score"]
                module_quality_count += 1
            if doc.get("language"):
                module_languages.add(doc["language"])

        avg_mod_quality = round(module_quality / module_quality_count) if module_quality_count else 0

        sections.append({
            "title": module_name,
            "type": "module",
            "content": "\n\n---\n\n".join(merged_docstrings) if merged_docstrings else "Documentation generated for this module.",
            "diagrams": merged_diagrams,
            "quality_score": avg_mod_quality,
            "file_count": len(module_docs),
            "languages": list(module_languages),
        })

    return {
        "job_id": job_id,
        "repo_url": job.get("repo_url"),
        "repo_name": repo_name,
        "branch": job.get("branch"),
        "status": job.get("status"),
        "total_files": job.get("total_files", len(file_results)),
        "sections": sections,
        "summary": {
            "total_files": len(per_file_docs),
            "languages": languages,
            "average_quality": avg_quality,
            "total_diagrams": len(all_diagrams),
        },
    }
