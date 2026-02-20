from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import uuid
import io
import re
import zipfile
import markdown as md_lib

from database import db
from middleware.auth import get_current_user
from models import (
    DocumentationCreate, DocumentationResponse, DocumentationUpdate,
    GenerateDocsRequest, BatchExportRequest, JobResponse
)
from services.doc_service import generate_docx_from_documentation
from websocket import ws_manager
from agents.orchestrator import orchestrator

docs_router = APIRouter(prefix="/api/documentation", tags=["Documentation"])


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

async def update_job_progress(job_id: str, progress: int, stage: str):
    """Update job progress in the database and notify via WebSocket."""
    await db.jobs.update_one(
        {"id": job_id},
        {
            "$set": {
                "progress": progress,
                "stage": stage,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    await ws_manager.broadcast(
        {
            "type": "job_progress",
            "job_id": job_id,
            "progress": progress,
            "stage": stage,
        }
    )


async def run_documentation_job(
    job_id: str,
    tenant_id: str,
    source_code: str,
    language: str,
    style: str,
    repository_id: Optional[str] = None,
    component_path: Optional[str] = None,
):
    """Background task that drives the orchestrator to generate documentation."""
    try:
        await db.jobs.update_one(
            {"id": job_id},
            {
                "$set": {
                    "status": "processing",
                    "stage": "initializing",
                    "progress": 0,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

        await update_job_progress(job_id, 10, "parsing_source")

        result = await orchestrator.generate_documentation(
            source_code=source_code,
            language=language,
            style=style,
            progress_callback=lambda p, s: update_job_progress(job_id, p, s),
        )

        doc_data = result.get("documentation", {})
        doc_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        doc_record = {
            "id": doc_id,
            "tenant_id": tenant_id,
            "repository_id": repository_id,
            "component_path": component_path or "",
            "source_code": source_code,
            "language": language,
            "style": style,
            "docstring": doc_data.get("docstring", ""),
            "markdown": doc_data.get("markdown", ""),
            "metadata": {
                "quality_score": doc_data.get("quality_score", 0),
                "examples": doc_data.get("examples", []),
                "diagram": doc_data.get("diagram"),
                "stages": result.get("stages", {}),
            },
            "version": 1,
            "created_at": now,
            "updated_at": now,
        }

        await db.documentation.insert_one(doc_record)

        await db.jobs.update_one(
            {"id": job_id},
            {
                "$set": {
                    "status": "completed",
                    "progress": 100,
                    "stage": "done",
                    "result": {"documentation_id": doc_id},
                    "completed_at": now,
                    "updated_at": now,
                }
            },
        )

        await ws_manager.broadcast(
            {
                "type": "job_completed",
                "job_id": job_id,
                "documentation_id": doc_id,
            }
        )

    except Exception as exc:
        now = datetime.now(timezone.utc).isoformat()
        await db.jobs.update_one(
            {"id": job_id},
            {
                "$set": {
                    "status": "failed",
                    "stage": "error",
                    "error": str(exc),
                    "completed_at": now,
                    "updated_at": now,
                }
            },
        )
        await ws_manager.broadcast(
            {
                "type": "job_failed",
                "job_id": job_id,
                "error": str(exc),
            }
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@docs_router.get("/")
async def list_documentation(
    repository_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List documentation records, optionally filtered by repository_id."""
    tenant_id = user["tenant_id"]
    query: Dict[str, Any] = {"tenant_id": tenant_id}
    if repository_id:
        query["repository_id"] = repository_id

    docs = await db.documentation.find(query).to_list(length=None)
    for doc in docs:
        doc.pop("_id", None)
    return docs


@docs_router.get("/search/query")
async def search_documentation(
    q: str,
    user: dict = Depends(get_current_user),
):
    """Search documentation across component_path, docstring, and markdown fields."""
    tenant_id = user["tenant_id"]
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty")

    regex_pattern = {"$regex": re.escape(q), "$options": "i"}
    query = {
        "tenant_id": tenant_id,
        "$or": [
            {"component_path": regex_pattern},
            {"docstring": regex_pattern},
            {"markdown": regex_pattern},
        ],
    }

    docs = await db.documentation.find(query).to_list(length=None)
    for doc in docs:
        doc.pop("_id", None)
    return docs


@docs_router.get("/{doc_id}")
async def get_documentation(
    doc_id: str,
    user: dict = Depends(get_current_user),
):
    """Retrieve a single documentation record by id."""
    tenant_id = user["tenant_id"]
    doc = await db.documentation.find_one({"id": doc_id, "tenant_id": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documentation not found")
    doc.pop("_id", None)
    return doc


@docs_router.put("/{doc_id}")
async def update_documentation(
    doc_id: str,
    body: DocumentationUpdate,
    user: dict = Depends(get_current_user),
):
    """Update documentation content (inline editing). Increments version."""
    tenant_id = user["tenant_id"]
    doc = await db.documentation.find_one({"id": doc_id, "tenant_id": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documentation not found")

    update_fields: Dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "version": doc.get("version", 1) + 1,
    }

    if body.docstring is not None:
        update_fields["docstring"] = body.docstring
    if body.markdown is not None:
        update_fields["markdown"] = body.markdown
    if body.component_path is not None:
        update_fields["component_path"] = body.component_path

    await db.documentation.update_one(
        {"id": doc_id, "tenant_id": tenant_id},
        {"$set": update_fields},
    )

    updated = await db.documentation.find_one({"id": doc_id, "tenant_id": tenant_id})
    updated.pop("_id", None)
    return updated


@docs_router.delete("/{doc_id}")
async def delete_documentation(
    doc_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a documentation record and its version history."""
    tenant_id = user["tenant_id"]
    doc = await db.documentation.find_one({"id": doc_id, "tenant_id": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documentation not found")

    await db.documentation.delete_one({"id": doc_id, "tenant_id": tenant_id})
    await db.doc_versions.delete_many({"documentation_id": doc_id, "tenant_id": tenant_id})
    return {"detail": "Documentation deleted successfully"}


@docs_router.post("/{doc_id}/regenerate")
async def regenerate_documentation(
    doc_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Save the current version to doc_versions and create a new generation job."""
    tenant_id = user["tenant_id"]
    doc = await db.documentation.find_one({"id": doc_id, "tenant_id": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documentation not found")

    # Save current state as a version snapshot
    version_record = {
        "id": str(uuid.uuid4()),
        "documentation_id": doc_id,
        "tenant_id": tenant_id,
        "version": doc.get("version", 1),
        "docstring": doc.get("docstring", ""),
        "markdown": doc.get("markdown", ""),
        "metadata": doc.get("metadata", {}),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.doc_versions.insert_one(version_record)

    # Create a new job for regeneration
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    job_record = {
        "id": job_id,
        "tenant_id": tenant_id,
        "type": "regenerate",
        "status": "queued",
        "progress": 0,
        "stage": "queued",
        "documentation_id": doc_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.jobs.insert_one(job_record)

    background_tasks.add_task(
        run_documentation_job,
        job_id=job_id,
        tenant_id=tenant_id,
        source_code=doc.get("source_code", doc.get("docstring", "")),
        language=doc.get("language", "python"),
        style=doc.get("style", "google"),
        repository_id=doc.get("repository_id"),
        component_path=doc.get("component_path"),
    )

    return {"job_id": job_id, "documentation_id": doc_id, "status": "queued"}


@docs_router.get("/{doc_id}/versions")
async def get_documentation_versions(
    doc_id: str,
    user: dict = Depends(get_current_user),
):
    """Retrieve version history for a documentation record."""
    tenant_id = user["tenant_id"]

    doc = await db.documentation.find_one({"id": doc_id, "tenant_id": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documentation not found")

    versions = (
        await db.doc_versions.find(
            {"documentation_id": doc_id, "tenant_id": tenant_id}
        )
        .sort("version", -1)
        .to_list(length=None)
    )

    for v in versions:
        v.pop("_id", None)
    return versions


@docs_router.post("/batch-export")
async def batch_export_documentation(
    body: BatchExportRequest,
    user: dict = Depends(get_current_user),
):
    """Export multiple documentation records as a ZIP archive.

    Supported formats: markdown, html, pdf, docx.
    """
    tenant_id = user["tenant_id"]
    doc_ids = body.doc_ids
    export_format = (body.format or "markdown").lower()

    if export_format not in ("markdown", "html", "pdf", "docx"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported export format: {export_format}. Supported: markdown, html, pdf, docx",
        )

    docs = await db.documentation.find(
        {"id": {"$in": doc_ids}, "tenant_id": tenant_id}
    ).to_list(length=None)

    if not docs:
        raise HTTPException(status_code=404, detail="No documentation found for the provided IDs")

    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for doc in docs:
            safe_name = re.sub(r'[^\w\-.]', '_', doc.get("component_path", doc["id"]))

            if export_format == "markdown":
                content = doc.get("markdown", "") or doc.get("docstring", "")
                filename = f"{safe_name}.md"
                zf.writestr(filename, content)

            elif export_format == "html":
                md_content = doc.get("markdown", "") or doc.get("docstring", "")
                html_body = md_lib.markdown(
                    md_content, extensions=["fenced_code", "tables", "codehilite"]
                )
                html_content = (
                    "<!DOCTYPE html>\n<html>\n<head>\n"
                    '<meta charset="utf-8">\n'
                    f"<title>{safe_name}</title>\n"
                    "<style>\n"
                    "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', "
                    "Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; "
                    "line-height: 1.6; }\n"
                    "pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; "
                    "overflow-x: auto; }\n"
                    "code { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.9em; }\n"
                    "table { border-collapse: collapse; width: 100%; }\n"
                    "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n"
                    "th { background: #f6f8fa; }\n"
                    "</style>\n"
                    "</head>\n<body>\n"
                    f"{html_body}\n"
                    "</body>\n</html>"
                )
                filename = f"{safe_name}.html"
                zf.writestr(filename, html_content)

            elif export_format == "pdf":
                from fpdf import FPDF

                md_content = doc.get("markdown", "") or doc.get("docstring", "")
                pdf = FPDF()
                pdf.add_page()
                pdf.set_auto_page_break(auto=True, margin=15)
                pdf.set_font("Helvetica", size=11)

                lines = md_content.split("\n")
                for line in lines:
                    stripped = line.strip()
                    if stripped.startswith("# "):
                        pdf.set_font("Helvetica", style="B", size=18)
                        pdf.cell(0, 10, stripped[2:], new_x="LMARGIN", new_y="NEXT")
                        pdf.set_font("Helvetica", size=11)
                    elif stripped.startswith("## "):
                        pdf.set_font("Helvetica", style="B", size=15)
                        pdf.cell(0, 9, stripped[3:], new_x="LMARGIN", new_y="NEXT")
                        pdf.set_font("Helvetica", size=11)
                    elif stripped.startswith("### "):
                        pdf.set_font("Helvetica", style="B", size=13)
                        pdf.cell(0, 8, stripped[4:], new_x="LMARGIN", new_y="NEXT")
                        pdf.set_font("Helvetica", size=11)
                    elif stripped.startswith("```"):
                        pdf.set_font("Courier", size=10)
                    elif stripped == "":
                        pdf.ln(4)
                    else:
                        pdf.multi_cell(0, 6, stripped)

                pdf_bytes = pdf.output()
                filename = f"{safe_name}.pdf"
                zf.writestr(filename, pdf_bytes)

            elif export_format == "docx":
                docx_bytes = generate_docx_from_documentation(doc)
                filename = f"{safe_name}.docx"
                zf.writestr(filename, docx_bytes)

    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=documentation_export.zip"},
    )


@docs_router.post("/generate")
async def generate_documentation(
    body: GenerateDocsRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Start a documentation generation job."""
    tenant_id = user["tenant_id"]
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    job_record = {
        "id": job_id,
        "tenant_id": tenant_id,
        "type": "generate",
        "status": "queued",
        "progress": 0,
        "stage": "queued",
        "source_language": body.language,
        "style": body.style,
        "repository_id": body.repository_id,
        "component_path": body.component_path,
        "created_at": now,
        "updated_at": now,
    }

    await db.jobs.insert_one(job_record)

    background_tasks.add_task(
        run_documentation_job,
        job_id=job_id,
        tenant_id=tenant_id,
        source_code=body.source_code,
        language=body.language,
        style=body.style,
        repository_id=body.repository_id,
        component_path=body.component_path,
    )

    return {"job_id": job_id, "status": "queued"}


# ---------------------------------------------------------------------------
# File Upload
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go", ".cpp", ".c", ".cs", ".rs", ".rb", ".php", ".swift", ".kt"}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB


@docs_router.post("/upload")
async def upload_code_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form(default="auto"),
    style: str = Form(default="google"),
    repository_id: Optional[str] = Form(default=None),
    user: dict = Depends(get_current_user),
):
    """Upload a code file directly for documentation generation."""
    # Validate file extension
    import os
    _, ext = os.path.splitext(file.filename or "")
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds maximum size of 10MB")

    source_code = content.decode("utf-8", errors="replace")

    # Auto-detect language from extension if needed
    ext_to_lang = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".jsx": "javascript", ".tsx": "typescript", ".java": "java",
        ".go": "go", ".cpp": "cpp", ".c": "c", ".cs": "csharp",
        ".rs": "rust", ".rb": "ruby", ".php": "php", ".swift": "swift",
        ".kt": "kotlin",
    }
    if language == "auto":
        language = ext_to_lang.get(ext.lower(), "python")

    tenant_id = user["tenant_id"]
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    job_record = {
        "id": job_id,
        "tenant_id": tenant_id,
        "type": "upload",
        "status": "queued",
        "progress": 0,
        "stage": "queued",
        "source_language": language,
        "style": style,
        "repository_id": repository_id,
        "component_path": file.filename,
        "created_at": now,
        "updated_at": now,
    }
    await db.jobs.insert_one(job_record)

    background_tasks.add_task(
        run_documentation_job,
        job_id=job_id,
        tenant_id=tenant_id,
        source_code=source_code,
        language=language,
        style=style,
        repository_id=repository_id,
        component_path=file.filename,
    )

    return {"job_id": job_id, "filename": file.filename, "language": language, "status": "queued"}


# ---------------------------------------------------------------------------
# Scheduled Documentation Regeneration
# ---------------------------------------------------------------------------

@docs_router.post("/schedules")
async def create_schedule(
    documentation_id: str,
    interval: str = "weekly",
    user: dict = Depends(get_current_user),
):
    """Create a schedule for automatic documentation regeneration."""
    if interval not in ("daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="Interval must be daily, weekly, or monthly")

    tenant_id = user["tenant_id"]

    # Verify doc exists
    doc = await db.documentation.find_one({"id": documentation_id, "tenant_id": tenant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Documentation not found")

    schedule_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    schedule = {
        "id": schedule_id,
        "tenant_id": tenant_id,
        "documentation_id": documentation_id,
        "interval": interval,
        "is_active": True,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
        "last_run_at": None,
    }
    await db.schedules.insert_one(schedule)

    # Register with scheduler
    from services.scheduler_service import add_schedule_job
    await add_schedule_job(schedule_id, interval, documentation_id, tenant_id)

    return schedule


@docs_router.get("/schedules")
async def list_schedules(user: dict = Depends(get_current_user)):
    """List all documentation regeneration schedules."""
    schedules = await db.schedules.find(
        {"tenant_id": user["tenant_id"]}
    ).sort("created_at", -1).to_list(50)

    for s in schedules:
        s.pop("_id", None)
    return schedules


@docs_router.put("/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    interval: str = "weekly",
    is_active: bool = True,
    user: dict = Depends(get_current_user),
):
    """Update a documentation regeneration schedule."""
    if interval not in ("daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="Interval must be daily, weekly, or monthly")

    schedule = await db.schedules.find_one({
        "id": schedule_id,
        "tenant_id": user["tenant_id"]
    })
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    await db.schedules.update_one(
        {"id": schedule_id},
        {"$set": {
            "interval": interval,
            "is_active": is_active,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    from services.scheduler_service import add_schedule_job, remove_schedule_job
    if is_active:
        await add_schedule_job(schedule_id, interval, schedule.get("documentation_id"), user["tenant_id"])
    else:
        await remove_schedule_job(schedule_id)

    updated = await db.schedules.find_one({"id": schedule_id})
    updated.pop("_id", None)
    return updated


@docs_router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user: dict = Depends(get_current_user)):
    """Delete a documentation regeneration schedule."""
    result = await db.schedules.delete_one({
        "id": schedule_id,
        "tenant_id": user["tenant_id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")

    from services.scheduler_service import remove_schedule_job
    await remove_schedule_job(schedule_id)

    return {"detail": "Schedule deleted"}
