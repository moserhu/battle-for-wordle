from pydantic import BaseModel, constr
from typing import Optional, List

class GuessRequest(BaseModel):
    word: str

class GuessWithMeta(BaseModel):
    word: str
    campaign_id: int
    day: Optional[int] = None

class UserLogin(BaseModel):
    email: str  
    password: str

class NewCampaign(BaseModel):
    name: constr(max_length=32)
    cycle_length: int
    is_admin_campaign: Optional[bool] = False

class JoinCampaign(BaseModel):
    invite_code: str

class CampaignIDOnly(BaseModel):
    campaign_id: int

class CampaignOnly(BaseModel):
    campaign_id: int
    day: Optional[int] = None

class CampaignRulerTitle(BaseModel):
    campaign_id: int
    title: str

class CampaignNameUpdate(BaseModel):
    campaign_id: int
    name: constr(max_length=32)

class UserRegister(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: str 
    password: str

class UserOnly(BaseModel):
    user_id: int

class CampaignAndUserOnly(BaseModel):
    user_id: int
    campaign_id: int
    display_name: str
    color: str

class UpdateUserInfo(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    phone: str

class KickRequest(BaseModel):
    campaign_id: int
    user_id: int

class ShopPurchase(BaseModel):
    campaign_id: int
    item_key: str

class ShopReshuffle(BaseModel):
    campaign_id: int
    category: str

class UseItemRequest(BaseModel):
    campaign_id: int
    item_key: str
    target_user_id: Optional[int] = None
    effect_payload: Optional[dict] = None

class ItemTargetRequest(BaseModel):
    campaign_id: int
    item_key: str

class ProfileImagePresign(BaseModel):
    filename: str
    content_type: str

class ProfileImageConfirm(BaseModel):
    key: str
    file_url: str

class ArmyImagePresign(BaseModel):
    campaign_id: int
    filename: str
    content_type: str

class ArmyImageConfirm(BaseModel):
    campaign_id: int
    key: str
    file_url: str

class RulerBackgroundPresign(BaseModel):
    campaign_id: int
    filename: str
    content_type: str

class RulerBackgroundConfirm(BaseModel):
    campaign_id: int
    key: str
    file_url: str

class ArmyNameUpdate(BaseModel):
    campaign_id: int
    army_name: str

class WeeklyRewardChoose(BaseModel):
    campaign_id: int
    recipient_user_ids: List[int]
