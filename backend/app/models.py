from pydantic import BaseModel

class GuessRequest(BaseModel):
    word: str

class GuessWithMeta(BaseModel):
    word: str
    campaign_id: int

class UserLogin(BaseModel):
    email: str  
    password: str

class NewCampaign(BaseModel):
    name: str
    cycle_length: int

class JoinCampaign(BaseModel):
    invite_code: str

class CampaignIDOnly(BaseModel):
    campaign_id: int

class CampaignOnly(BaseModel):
    campaign_id: int

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

