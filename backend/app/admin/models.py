from pydantic import BaseModel
from typing import Optional, Dict

class AdminEffectRequest(BaseModel):
    campaign_id: int
    effect_key: str
    effect_payload: Optional[Dict] = None

class AdminAmountRequest(BaseModel):
    campaign_id: int
    amount: int
