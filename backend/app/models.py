from pydantic import BaseModel
from typing import Optional

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
    name: str
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

class UseItemRequest(BaseModel):
    campaign_id: int
    item_key: str
    target_user_id: Optional[int] = None
    effect_payload: Optional[dict] = None

class ItemTargetRequest(BaseModel):
    campaign_id: int
    item_key: str
