from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session


def get_scoped_entity(db: Session, model, entity_id: int, workspace_id: int, not_found_detail: str):
    entity = db.get(model, entity_id)
    if not entity or getattr(entity, "workspace_id", None) != workspace_id:
        raise HTTPException(status_code=404, detail=not_found_detail)
    return entity


def assert_same_workspace(resource_workspace_id: int, user_workspace_id: int, not_found_detail: str = "Not found") -> None:
    if resource_workspace_id != user_workspace_id:
        raise HTTPException(status_code=404, detail=not_found_detail)
