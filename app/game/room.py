from datetime import datetime, timezone
from typing import List, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class Room(BaseModel):
    room_id: UUID
    creator_id: UUID
    players: List[UUID] = Field(default_factory=list)
    status: Literal["waiting", "playing", "finished"] = "waiting"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



# 3. Создать структуру комнаты
#
# Каждая комната должна хранить:
#
# room_id — уникальный идентификатор
#
# creator_id — кто создал (ID пользователя)
#
# players — список ID игроков
#
# status — waiting, playing, finished
#
# created_at — время создания

