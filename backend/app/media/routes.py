from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.models import (
    ProfileImagePresign,
    ProfileImageConfirm,
    ArmyImagePresign,
    ArmyImageConfirm,
    RulerBackgroundPresign,
    RulerBackgroundConfirm,
    CampaignIDOnly,
)
from app.media import service

router = APIRouter(prefix="/api", tags=["media"])


@router.post("/user/profile-image/presign")
def presign_profile_image(data: ProfileImagePresign, current_user: dict = Depends(get_current_user)):
    return service.create_profile_image_upload(current_user["user_id"], data.filename, data.content_type)


@router.post("/user/profile-image/confirm")
def confirm_profile_image(data: ProfileImageConfirm, current_user: dict = Depends(get_current_user)):
    return service.confirm_profile_image_upload(current_user["user_id"], data.key, data.file_url)


@router.post("/campaign/army-image/presign")
def presign_army_image(data: ArmyImagePresign, current_user: dict = Depends(get_current_user)):
    return service.create_army_image_upload(current_user["user_id"], data.campaign_id, data.filename, data.content_type)


@router.post("/campaign/army-image/confirm")
def confirm_army_image(data: ArmyImageConfirm, current_user: dict = Depends(get_current_user)):
    return service.confirm_army_image_upload(current_user["user_id"], data.campaign_id, data.key, data.file_url)


@router.post("/campaign/ruler-background/presign")
def presign_ruler_background(data: RulerBackgroundPresign, current_user: dict = Depends(get_current_user)):
    return service.create_ruler_background_upload(current_user["user_id"], data.campaign_id, data.filename, data.content_type)


@router.post("/campaign/ruler-background/confirm")
def confirm_ruler_background(data: RulerBackgroundConfirm, current_user: dict = Depends(get_current_user)):
    return service.confirm_ruler_background_upload(current_user["user_id"], data.campaign_id, data.key, data.file_url)


@router.post("/campaign/ruler-background/reset")
def reset_ruler_background(data: CampaignIDOnly, current_user: dict = Depends(get_current_user)):
    return service.clear_ruler_background(current_user["user_id"], data.campaign_id)
