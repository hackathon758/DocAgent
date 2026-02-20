from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime, timezone
import uuid

from database import db
from middleware.auth import get_current_user
from models.collaboration import CommentCreate, CommentUpdate, CommentResponse

comments_router = APIRouter(prefix="/api", tags=["Comments"])


@comments_router.post("/documentation/{doc_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(doc_id: str, comment: CommentCreate, current_user: dict = Depends(get_current_user)):
    """Add a comment to a documentation item."""
    doc = await db.documentation.find_one({"id": doc_id, "tenant_id": current_user["tenant_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Documentation not found")

    comment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    comment_doc = {
        "id": comment_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "tenant_id": current_user["tenant_id"],
        "documentation_id": doc_id,
        "content": comment.content,
        "section_id": comment.section_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.comments.insert_one(comment_doc)

    # Create notification for doc owner (if different from commenter)
    if doc.get("created_by") and doc["created_by"] != current_user["id"]:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": doc["created_by"],
            "tenant_id": current_user["tenant_id"],
            "type": "comment_added",
            "title": "New comment on your documentation",
            "message": f"{current_user['name']} commented on {doc.get('component_path', 'a document')}",
            "read": False,
            "metadata": {"documentation_id": doc_id, "comment_id": comment_id},
            "created_at": now,
        })

    return CommentResponse(**{k: v for k, v in comment_doc.items() if k != "tenant_id" and k != "_id"})


@comments_router.get("/documentation/{doc_id}/comments")
async def list_comments(doc_id: str, current_user: dict = Depends(get_current_user)):
    """List all comments for a documentation item."""
    comments = await db.comments.find(
        {"documentation_id": doc_id, "tenant_id": current_user["tenant_id"]}
    ).sort("created_at", 1).to_list(500)

    return [
        CommentResponse(
            id=c["id"],
            user_id=c["user_id"],
            user_name=c.get("user_name", "Unknown"),
            documentation_id=c["documentation_id"],
            content=c["content"],
            section_id=c.get("section_id"),
            created_at=c["created_at"],
            updated_at=c.get("updated_at"),
        )
        for c in comments
    ]


@comments_router.put("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(comment_id: str, update: CommentUpdate, current_user: dict = Depends(get_current_user)):
    """Edit own comment."""
    comment = await db.comments.find_one({"id": comment_id, "tenant_id": current_user["tenant_id"]})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment["user_id"] != current_user["id"] and current_user.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")

    now = datetime.now(timezone.utc).isoformat()
    await db.comments.update_one(
        {"id": comment_id},
        {"$set": {"content": update.content, "updated_at": now}},
    )

    comment["content"] = update.content
    comment["updated_at"] = now
    return CommentResponse(
        id=comment["id"],
        user_id=comment["user_id"],
        user_name=comment.get("user_name", "Unknown"),
        documentation_id=comment["documentation_id"],
        content=comment["content"],
        section_id=comment.get("section_id"),
        created_at=comment["created_at"],
        updated_at=comment["updated_at"],
    )


@comments_router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    """Delete own comment (or admin/owner can delete any)."""
    comment = await db.comments.find_one({"id": comment_id, "tenant_id": current_user["tenant_id"]})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment["user_id"] != current_user["id"] and current_user.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    await db.comments.delete_one({"id": comment_id})
