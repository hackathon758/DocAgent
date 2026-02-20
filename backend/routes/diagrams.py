from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from typing import List, Optional
import uuid
import io

from database import db
from middleware.auth import get_current_user
from models import DiagramRequest, DiagramCreate, DiagramResponse, DiagramUpdate
from agents.orchestrator import orchestrator
from services.doc_service import render_mermaid_to_image

diagrams_router = APIRouter(prefix="/api/diagrams", tags=["Diagrams"])


@diagrams_router.get("/", response_model=List[DiagramResponse])
async def list_diagrams(
    repository_id: Optional[str] = None,
    documentation_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List diagrams for the current tenant, with optional filtering."""
    query = {"tenant_id": current_user["tenant_id"]}
    if repository_id:
        query["repository_id"] = repository_id
    if documentation_id:
        query["documentation_id"] = documentation_id

    diagrams = await db.diagrams.find(query).to_list(length=None)
    return diagrams


@diagrams_router.post("/generate", response_model=DiagramResponse)
async def generate_diagram(
    request: DiagramRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate a diagram from source code using the diagram agent."""
    try:
        source = request.component_data
        if isinstance(source, dict):
            source = source.get("source_code", source.get("code", str(source)))
        result = await orchestrator.diagram.generate_diagram(
            source_code=str(source),
            diagram_type=request.diagram_type or "flowchart",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagram generation failed: {str(e)}")

    now = datetime.now(timezone.utc).isoformat()
    diagram_doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": current_user["tenant_id"],
        "documentation_id": None,
        "repository_id": None,
        "diagram_type": request.diagram_type or "flowchart",
        "mermaid_code": result.get("mermaid_code", ""),
        "description": result.get("description"),
        "created_at": now,
        "updated_at": None,
    }

    await db.diagrams.insert_one(diagram_doc)
    return diagram_doc


@diagrams_router.get("/{diagram_id}", response_model=DiagramResponse)
async def get_diagram(
    diagram_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single diagram by ID."""
    diagram = await db.diagrams.find_one({
        "id": diagram_id,
        "tenant_id": current_user["tenant_id"],
    })
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    return diagram


@diagrams_router.put("/{diagram_id}", response_model=DiagramResponse)
async def update_diagram(
    diagram_id: str,
    update: DiagramUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a diagram's mermaid_code, description, or diagram_type."""
    diagram = await db.diagrams.find_one({
        "id": diagram_id,
        "tenant_id": current_user["tenant_id"],
    })
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")

    update_fields = {}
    if update.mermaid_code is not None:
        update_fields["mermaid_code"] = update.mermaid_code
    if update.description is not None:
        update_fields["description"] = update.description
    if update.diagram_type is not None:
        update_fields["diagram_type"] = update.diagram_type

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.diagrams.update_one(
        {"id": diagram_id, "tenant_id": current_user["tenant_id"]},
        {"$set": update_fields},
    )

    updated_diagram = await db.diagrams.find_one({
        "id": diagram_id,
        "tenant_id": current_user["tenant_id"],
    })
    return updated_diagram


@diagrams_router.delete("/{diagram_id}")
async def delete_diagram(
    diagram_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a diagram."""
    result = await db.diagrams.delete_one({
        "id": diagram_id,
        "tenant_id": current_user["tenant_id"],
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Diagram not found")
    return {"message": "Diagram deleted successfully"}


@diagrams_router.get("/{diagram_id}/render")
async def render_diagram(
    diagram_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Render a diagram to PNG using the mermaid renderer."""
    diagram = await db.diagrams.find_one({
        "id": diagram_id,
        "tenant_id": current_user["tenant_id"],
    })
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")

    try:
        image_bytes = await render_mermaid_to_image(diagram["mermaid_code"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render diagram: {str(e)}")

    return StreamingResponse(
        io.BytesIO(image_bytes),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="diagram-{diagram_id}.png"'},
    )


@diagrams_router.post("/{diagram_id}/regenerate", response_model=DiagramResponse)
async def regenerate_diagram(
    diagram_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Regenerate a diagram by re-running the diagram agent on the associated documentation's source code."""
    diagram = await db.diagrams.find_one({
        "id": diagram_id,
        "tenant_id": current_user["tenant_id"],
    })
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")

    documentation_id = diagram.get("documentation_id")
    if not documentation_id:
        raise HTTPException(
            status_code=400,
            detail="Diagram has no associated documentation to regenerate from",
        )

    documentation = await db.documentation.find_one({
        "id": documentation_id,
        "tenant_id": current_user["tenant_id"],
    })
    if not documentation:
        raise HTTPException(status_code=404, detail="Associated documentation not found")

    source_code = documentation.get("source_code", "")
    if not source_code:
        raise HTTPException(
            status_code=400,
            detail="Associated documentation has no source code",
        )

    try:
        result = await orchestrator.diagram.generate_diagram(
            source_code=source_code,
            diagram_type=diagram.get("diagram_type", "flowchart"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagram regeneration failed: {str(e)}")

    now = datetime.now(timezone.utc).isoformat()
    update_fields = {
        "mermaid_code": result.get("mermaid_code", ""),
        "description": result.get("description"),
        "updated_at": now,
    }

    await db.diagrams.update_one(
        {"id": diagram_id, "tenant_id": current_user["tenant_id"]},
        {"$set": update_fields},
    )

    updated_diagram = await db.diagrams.find_one({
        "id": diagram_id,
        "tenant_id": current_user["tenant_id"],
    })
    return updated_diagram
