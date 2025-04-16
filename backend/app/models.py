from pydantic import BaseModel

class GuessRequest(BaseModel):
    word: str

class GuessWithMeta(BaseModel):
    word: str
    user_id: int
    campaign_id: int

class UserLogin(BaseModel):
    username: str
    password: str

class NewCampaign(BaseModel):
    name: str
    user_id: int

class JoinCampaign(BaseModel):
    invite_code: str
    user_id: int

class CampaignOnly(BaseModel):
    campaign_id: int

