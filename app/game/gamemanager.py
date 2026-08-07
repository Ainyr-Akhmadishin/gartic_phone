from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends

from app.game.room import Room
from app.models import Users
from app.auth import current_user
from app.redis import get_redis_client


class GameManager:
    def __init__(self):
        self.redis = None

    async def init(self):

        self.redis = await get_redis_client()

    async def create_room(self, room_id: UUID, creator_id: UUID) -> Room:
        room = Room(
            room_id=room_id,
            creator_id=creator_id,
            players = [creator_id],
            status="waiting",
            created_at=datetime.now(timezone.utc),
        )

        await self.redis.set(f'room:{room_id}', room.model_dump_json(), ex=3600)

        return room

    async def get_room(self, room_id: UUID) -> Room | None:
        data = await self.redis.get(f'room:{room_id}')
        if not data:
            return None
        return Room.model_validate_json(data)

    async def add_player(self, room_id:UUID, user_id: UUID):
        data = await self.redis.get(f'room:{room_id}')
        if not data:
            return None
        room = Room.model_validate_json(data)

        if user_id not in room.players:
            room.players.append(user_id)
        else:
            pass

        await self.redis.set(f'room:{room_id}', room.model_dump_json(), ex=3600)
        return room

game_manager = GameManager()