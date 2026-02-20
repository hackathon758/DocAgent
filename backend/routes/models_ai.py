"""
AI Models routes - manages cloud (Bytez) and local (Ollama) model operations.
Extracted from server.py lines 1634-1993.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from datetime import datetime, timezone
from typing import Dict, List, Any
import json
import logging
import httpx

from config import BYTEZ_API_KEY, BYTEZ_API_URL, AVAILABLE_LOCAL_MODELS, AI_MODELS

logger = logging.getLogger(__name__)
models_router = APIRouter(prefix="/api/models", tags=["AI Models"])

# Track download progress in-memory
model_download_progress: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

async def check_ollama_installed() -> Dict[str, Any]:
    """Check if Ollama is running at localhost:11434."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                return {"installed": True, "running": True, "error": None}
            return {"installed": True, "running": False, "error": f"Unexpected status code: {response.status_code}"}
    except httpx.ConnectError:
        return {"installed": False, "running": False, "error": "Ollama is not running or not installed"}
    except Exception as e:
        return {"installed": False, "running": False, "error": str(e)}


async def get_installed_models() -> List[Dict[str, Any]]:
    """Get list of installed Ollama models."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])
                return [
                    {
                        "name": m.get("name", ""),
                        "size": m.get("size", 0),
                        "modified_at": m.get("modified_at", ""),
                        "digest": m.get("digest", ""),
                        "details": m.get("details", {}),
                    }
                    for m in models
                ]
            return []
    except Exception as e:
        logger.error(f"Error fetching installed models: {e}")
        return []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@models_router.get("/")
async def list_models():
    """List AI models – both cloud (Bytez) and local (Ollama).

    Marks each model with its installed status and any agent_assignments.
    """
    cloud_models: List[Dict[str, Any]] = []
    local_models: List[Dict[str, Any]] = []

    # --- Cloud / Bytez models (from config) ---
    if BYTEZ_API_KEY:
        for key, m in AI_MODELS.items():
            cloud_models.append(
                {
                    "id": m["id"],
                    "name": m["name"],
                    "provider": "bytez",
                    "type": "cloud",
                    "description": m.get("description", ""),
                    "installed": True,  # cloud models are always available via API
                    "agent_assignments": m.get("tasks", []),
                }
            )

    # --- Local / Ollama models ---
    ollama_status = await check_ollama_installed()
    installed_models = await get_installed_models() if ollama_status["running"] else []
    installed_names = {m["name"] for m in installed_models}

    for model_def in AVAILABLE_LOCAL_MODELS:
        model_id = model_def if isinstance(model_def, str) else model_def.get("id", "")
        model_name = model_id if isinstance(model_def, str) else model_def.get("name", model_id)
        description = "" if isinstance(model_def, str) else model_def.get("description", "")

        is_installed = model_id in installed_names or any(
            model_id in name for name in installed_names
        )

        local_models.append(
            {
                "id": model_id,
                "name": model_name,
                "provider": "ollama",
                "type": "local",
                "description": description,
                "installed": is_installed,
                "agent_assignments": [],
            }
        )

    # Add any installed models that are not in the default available list
    listed_ids = {m["id"] for m in local_models}
    for m in installed_models:
        if m["name"] not in listed_ids:
            local_models.append(
                {
                    "id": m["name"],
                    "name": m["name"],
                    "provider": "ollama",
                    "type": "local",
                    "description": f"Size: {round(m['size'] / 1e9, 2)} GB" if m.get("size") else "",
                    "installed": True,
                    "agent_assignments": [],
                }
            )

    return {
        "cloud_models": cloud_models,
        "local_models": local_models,
        "ollama_status": ollama_status,
    }


@models_router.get("/status")
async def models_status():
    """Check Bytez API and Ollama connectivity status."""
    bytez_status = {"available": False, "error": None}
    if BYTEZ_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{BYTEZ_API_URL}/list/tasks",
                    headers={"Authorization": BYTEZ_API_KEY},
                )
                bytez_status["available"] = resp.status_code == 200
                if resp.status_code != 200:
                    bytez_status["error"] = f"HTTP {resp.status_code}"
        except Exception as e:
            bytez_status["error"] = str(e)
    else:
        bytez_status["error"] = "BYTEZ_API_KEY not configured"

    ollama_status = await check_ollama_installed()

    return {
        "bytez": bytez_status,
        "ollama": ollama_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@models_router.post("/download/{model_id:path}")
async def download_model(model_id: str, background_tasks: BackgroundTasks):
    """Download (pull) a model via the Ollama pull API with streaming progress."""
    ollama_status = await check_ollama_installed()
    if not ollama_status["running"]:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running. Please start Ollama first.",
        )

    # Initialise progress tracking
    model_download_progress[model_id] = {
        "status": "downloading",
        "progress": 0,
        "total": 0,
        "completed": 0,
        "error": None,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }

    async def _pull_model(mid: str):
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                async with client.stream(
                    "POST",
                    "http://localhost:11434/api/pull",
                    json={"name": mid, "stream": True},
                ) as response:
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        total = data.get("total", 0)
                        completed = data.get("completed", 0)
                        status_text = data.get("status", "")

                        progress_pct = 0
                        if total and total > 0:
                            progress_pct = round((completed / total) * 100, 2)

                        model_download_progress[mid].update(
                            {
                                "status": status_text if status_text else "downloading",
                                "progress": progress_pct,
                                "total": total,
                                "completed": completed,
                            }
                        )

                        if status_text == "success":
                            model_download_progress[mid]["status"] = "completed"
                            model_download_progress[mid]["progress"] = 100

        except Exception as exc:
            logger.error(f"Error downloading model {mid}: {exc}")
            model_download_progress[mid]["status"] = "error"
            model_download_progress[mid]["error"] = str(exc)

    background_tasks.add_task(_pull_model, model_id)

    return {
        "message": f"Download started for model '{model_id}'",
        "model_id": model_id,
        "status": "downloading",
    }


@models_router.get("/download/{model_id:path}/progress")
async def download_progress(model_id: str):
    """Get download progress for a model."""
    progress = model_download_progress.get(model_id)
    if progress is None:
        raise HTTPException(status_code=404, detail=f"No download in progress for model '{model_id}'")
    return {"model_id": model_id, **progress}


@models_router.delete("/{model_id:path}")
async def delete_model(model_id: str):
    """Delete a model from Ollama."""
    ollama_status = await check_ollama_installed()
    if not ollama_status["running"]:
        raise HTTPException(status_code=503, detail="Ollama is not running.")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                "http://localhost:11434/api/delete",
                json={"name": model_id},
            )
            if response.status_code == 200:
                return {"message": f"Model '{model_id}' deleted successfully"}
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to delete model: {response.text}",
                )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with Ollama: {e}")


@models_router.post("/chat/{model_id:path}")
async def chat_with_model(model_id: str, payload: Dict[str, Any]):
    """Chat with a local Ollama model."""
    ollama_status = await check_ollama_installed()
    if not ollama_status["running"]:
        raise HTTPException(status_code=503, detail="Ollama is not running.")

    messages = payload.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": model_id,
                    "messages": messages,
                    "stream": False,
                },
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "model": model_id,
                    "message": data.get("message", {}),
                    "done": data.get("done", True),
                    "total_duration": data.get("total_duration"),
                    "eval_count": data.get("eval_count"),
                }
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Ollama returned an error: {response.text}",
                )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with Ollama: {e}")


@models_router.get("/ollama/install-guide")
async def ollama_install_guide():
    """Return Ollama installation instructions for various platforms."""
    return {
        "title": "Ollama Installation Guide",
        "description": "Ollama lets you run large language models locally.",
        "platforms": {
            "macOS": {
                "steps": [
                    "Download Ollama from https://ollama.ai/download",
                    "Open the downloaded .dmg file and drag Ollama to Applications",
                    "Launch Ollama from Applications – it will run in the menu bar",
                    "Verify by running: ollama --version",
                ],
            },
            "Linux": {
                "steps": [
                    "Run: curl -fsSL https://ollama.ai/install.sh | sh",
                    "Start the service: systemctl start ollama",
                    "Verify by running: ollama --version",
                ],
            },
            "Windows": {
                "steps": [
                    "Download the installer from https://ollama.ai/download",
                    "Run the installer and follow the prompts",
                    "Ollama will start automatically as a background service",
                    "Verify by running: ollama --version",
                ],
            },
        },
        "post_install": [
            "Pull a model: ollama pull llama3",
            "Test it:      ollama run llama3 'Hello!'",
            "The DocAgent backend will auto-detect Ollama at http://localhost:11434",
        ],
    }
