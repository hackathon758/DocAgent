from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime, timezone, timedelta
import uuid
import secrets

from database import db
from middleware.auth import get_current_user
from models.collaboration import ShareLinkCreate, ShareLinkResponse

sharing_router = APIRouter(prefix="/api", tags=["Sharing"])


@sharing_router.post("/documentation/{doc_id}/share", response_model=ShareLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_share_link(doc_id: str, share_data: ShareLinkCreate, current_user: dict = Depends(get_current_user)):
    """Create a shareable link for a documentation item."""
    doc = await db.documentation.find_one({"id": doc_id, "tenant_id": current_user["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Documentation not found")

    share_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = None
    if share_data.expires_in_days:
        expires_at = (now + timedelta(days=share_data.expires_in_days)).isoformat()

    share_doc = {
        "id": share_id,
        "token": token,
        "tenant_id": current_user["tenant_id"],
        "documentation_id": doc_id,
        "created_by": current_user["id"],
        "expires_at": expires_at,
        "is_active": True,
        "created_at": now.isoformat(),
    }
    await db.share_links.insert_one(share_doc)

    return ShareLinkResponse(
        id=share_id,
        token=token,
        documentation_id=doc_id,
        created_by=current_user["id"],
        expires_at=expires_at,
        created_at=share_doc["created_at"],
        is_active=True,
    )


@sharing_router.get("/shared/{token}")
async def view_shared_document(token: str):
    """Public endpoint to view shared documentation (no auth required)."""
    share = await db.share_links.find_one({"token": token, "is_active": True})
    if not share:
        raise HTTPException(status_code=404, detail="Shared link not found or expired")

    # Check expiration
    if share.get("expires_at"):
        expires_at = datetime.fromisoformat(share["expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=410, detail="This shared link has expired")

    doc = await db.documentation.find_one({"id": share["documentation_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Documentation not found")

    # Get associated diagrams
    diagrams = await db.diagrams.find(
        {"documentation_id": share["documentation_id"]}
    ).to_list(50)

    return {
        "documentation": {
            "id": doc["id"],
            "component_path": doc.get("component_path", ""),
            "component_type": doc.get("component_type", ""),
            "language": doc.get("language", ""),
            "source_code": doc.get("source_code", ""),
            "docstring": doc.get("docstring", ""),
            "markdown": doc.get("markdown", ""),
            "metadata": doc.get("metadata", {}),
            "created_at": doc.get("created_at", ""),
        },
        "diagrams": [
            {
                "id": d["id"],
                "diagram_type": d.get("diagram_type", ""),
                "mermaid_code": d.get("mermaid_code", ""),
                "description": d.get("description", ""),
            }
            for d in diagrams
        ],
    }


@sharing_router.get("/documentation/{doc_id}/shares")
async def list_share_links(doc_id: str, current_user: dict = Depends(get_current_user)):
    """List active share links for a documentation item."""
    shares = await db.share_links.find(
        {"documentation_id": doc_id, "tenant_id": current_user["tenant_id"], "is_active": True}
    ).to_list(100)

    return [
        ShareLinkResponse(
            id=s["id"],
            token=s["token"],
            documentation_id=s["documentation_id"],
            created_by=s["created_by"],
            expires_at=s.get("expires_at"),
            created_at=s["created_at"],
            is_active=s["is_active"],
        )
        for s in shares
    ]


@sharing_router.delete("/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share_link(share_id: str, current_user: dict = Depends(get_current_user)):
    """Revoke a share link."""
    share = await db.share_links.find_one({"id": share_id, "tenant_id": current_user["tenant_id"]})
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")

    await db.share_links.update_one(
        {"id": share_id},
        {"$set": {"is_active": False}},
    )
