from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime, timezone
import uuid

from database import db
from middleware.auth import get_current_user
from models.template import TemplateCreate, TemplateUpdate, TemplateResponse

templates_router = APIRouter(prefix="/api/templates", tags=["Templates"])


@templates_router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(data: TemplateCreate, current_user: dict = Depends(get_current_user)):
    """Create a new documentation template."""
    template_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    template = {
        "id": template_id,
        "tenant_id": current_user["tenant_id"],
        "created_by": current_user["id"],
        "name": data.name,
        "description": data.description,
        "language": data.language,
        "content": data.content,
        "sections": data.sections,
        "is_default": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.templates.insert_one(template)

    return TemplateResponse(**{k: v for k, v in template.items() if k != "_id"})


@templates_router.get("/", response_model=list[TemplateResponse])
async def list_templates(current_user: dict = Depends(get_current_user)):
    """List all templates for the current tenant."""
    templates = await db.templates.find(
        {"tenant_id": current_user["tenant_id"]}
    ).sort("created_at", -1).to_list(100)

    return [
        TemplateResponse(**{k: v for k, v in t.items() if k != "_id"})
        for t in templates
    ]


@templates_router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific template by ID."""
    template = await db.templates.find_one({
        "id": template_id,
        "tenant_id": current_user["tenant_id"]
    })
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return TemplateResponse(**{k: v for k, v in template.items() if k != "_id"})


@templates_router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    data: TemplateUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an existing template."""
    template = await db.templates.find_one({
        "id": template_id,
        "tenant_id": current_user["tenant_id"]
    })
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field in ("name", "description", "language", "content", "sections"):
        value = getattr(data, field, None)
        if value is not None:
            update_fields[field] = value

    await db.templates.update_one({"id": template_id}, {"$set": update_fields})

    updated = await db.templates.find_one({"id": template_id})
    return TemplateResponse(**{k: v for k, v in updated.items() if k != "_id"})


@templates_router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a template."""
    result = await db.templates.delete_one({
        "id": template_id,
        "tenant_id": current_user["tenant_id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")


@templates_router.post("/{template_id}/set-default", response_model=TemplateResponse)
async def set_default_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Set a template as the default for the organization."""
    template = await db.templates.find_one({
        "id": template_id,
        "tenant_id": current_user["tenant_id"]
    })
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Unset any existing default
    await db.templates.update_many(
        {"tenant_id": current_user["tenant_id"], "is_default": True},
        {"$set": {"is_default": False}}
    )

    # Set this one as default
    await db.templates.update_one(
        {"id": template_id},
        {"$set": {"is_default": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    updated = await db.templates.find_one({"id": template_id})
    return TemplateResponse(**{k: v for k, v in updated.items() if k != "_id"})
