from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.models import CampaignOnly
from app.admin import service
from app.admin.models import AdminEffectRequest, AdminAmountRequest

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/effects")
def list_admin_effects(current_user: dict = Depends(get_current_user)):
    return service.list_admin_effects(current_user["user_id"])

@router.post("/effects/add")
def admin_add_effect(data: AdminEffectRequest, current_user: dict = Depends(get_current_user)):
    return service.admin_add_effect(
        current_user["user_id"],
        data.campaign_id,
        data.effect_key,
        data.effect_payload
    )

@router.post("/effects/clear")
def admin_clear_effects(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return service.admin_clear_effects(current_user["user_id"], data.campaign_id)

@router.post("/reset_day")
def admin_reset_day(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return service.admin_reset_day(current_user["user_id"], data.campaign_id)

@router.post("/add_coins")
def admin_add_coins(data: AdminAmountRequest, current_user: dict = Depends(get_current_user)):
    return service.admin_add_coins(current_user["user_id"], data.campaign_id, data.amount)

@router.post("/add_streak")
def admin_add_streak(data: AdminAmountRequest, current_user: dict = Depends(get_current_user)):
    return service.admin_add_streak(current_user["user_id"], data.campaign_id, data.amount)

@router.post("/reset_double_down")
def admin_reset_double_down(data: CampaignOnly, current_user: dict = Depends(get_current_user)):
    return service.admin_reset_double_down(current_user["user_id"], data.campaign_id)
