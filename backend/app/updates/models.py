from pydantic import BaseModel
from typing import List, Optional

class UpdateLogCreate(BaseModel):
    date: str
    title: str
    items: List[str]

class UpdateLogUpdate(BaseModel):
    date: Optional[str] = None
    title: Optional[str] = None
    items: Optional[List[str]] = None
