from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.updates.models import UpdateLogCreate, UpdateLogUpdate
from app.updates import service

router = APIRouter(prefix="/api/updates", tags=["updates"])

@router.get("")
def list_update_logs(current_user: dict = Depends(get_current_user)):
    return service.list_update_logs()

@router.post("")
def create_update_log(data: UpdateLogCreate, current_user: dict = Depends(get_current_user)):
    return service.create_update_log(current_user["user_id"], data.date, data.title, data.items)

@router.put("/{log_id}")
def update_update_log(log_id: int, data: UpdateLogUpdate, current_user: dict = Depends(get_current_user)):
    return service.update_update_log(current_user["user_id"], log_id, data.date, data.title, data.items)

@router.delete("/{log_id}")
def delete_update_log(log_id: int, current_user: dict = Depends(get_current_user)):
    return service.delete_update_log(current_user["user_id"], log_id)
