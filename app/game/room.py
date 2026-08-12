from datetime import datetime, timezone
from typing import List, Literal, Dict
from uuid import UUID

from pydantic import BaseModel, Field

class ChainItem(BaseModel):
    type: Literal["phrase", "drawing", "description"] = "drawing"
    text: str | None = None
    data: str| None = None
    round: int = 0



class Room(BaseModel):
    room_id: UUID
    creator_id: UUID
    players: List[UUID] = Field(default_factory=list)
    ready_players: List[UUID] = Field(default_factory=list)
    status: Literal["waiting", "playing", "finished"] = "waiting"
    phase: Literal["waiting", "writing", "drawing", "describing", "finished"] = "waiting"
    round: int = 0
    max_rounds: int = 3
    chain: Dict[str, List[ChainItem]]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))




