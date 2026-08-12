from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends

from app.game.room import Room, ChainItem
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
            players=[creator_id],
            status="waiting",
            created_at=datetime.now(timezone.utc),
            phase="waiting",
            round=0,
            max_rounds=3,
            chain={},
        )

        await self.redis.set(f'room:{room_id}', room.model_dump_json(), ex=3600)

        return room

    async def save_room(self, room: Room):
        await self.redis.set(f'room:{room.room_id}', room.model_dump_json(), ex=3600)

    async def get_room(self, room_id: UUID) -> Room | None:
        data = await self.redis.get(f'room:{room_id}')
        if not data:
            return None
        try:
            room = Room.model_validate_json(data)
            return room
        except Exception:
            return None

    async def add_player(self, room_id: UUID, user_id: UUID):
        room = await self.get_room(room_id)
        if not room:
            return None

        if user_id not in room.players:
            room.players.append(user_id)

        await self.redis.set(f'room:{room_id}', room.model_dump_json(), ex=3600)
        return room

    async def start_game(self, room_id: UUID, creator_id: UUID):
        room = await self.get_room(room_id)
        if not room:
            return None

        if room.creator_id != creator_id:
            return None

        if len(room.players) < 2:
            return None

        if room.status != "waiting":
            return None

        players_count = len(room.players)
        room.max_rounds = max(2, players_count - 1)

        room.status = "playing"
        room.phase = "writing"
        room.chain = {str(p): [] for p in room.players}

        await self.save_room(room)
        return room

    async def add_to_chain(self, room_id: UUID, user_id: UUID, item: ChainItem):
        room = await self.get_room(room_id)
        if not room:
            return None

        if user_id not in room.players:
            return None

        room.chain[str(user_id)].append(item)

        await self.save_room(room)
        return room

    async def get_previous_player(self, room: Room, user_id: UUID):
        if user_id not in room.players:
            return None

        index_player = room.players.index(user_id)
        prev_index = (index_player - 1 + len(room.players)) % len(room.players)
        return room.players[prev_index]

    async def get_task_for_user(self, room: Room, user_id: UUID):
        if room.phase == "writing":
            return {"type": "phrase", "text": "Напишите фразу"}

        elif room.phase == "drawing":
            prev_user = await self.get_previous_player(room, user_id)
            if prev_user is None:
                return None

            prev_chain = room.chain.get(str(prev_user), [])
            for item in reversed(prev_chain):
                if item.type == "phrase":
                    return {"type": "drawing", "text": f"Нарисуйте: {item.text}"}

            return None

        elif room.phase == "describing":
            prev_user = await self.get_previous_player(room, user_id)
            if prev_user is None:
                return None

            prev_chain = room.chain.get(str(prev_user), [])
            for item in reversed(prev_chain):
                if item.type == "drawing":
                    return {
                        "type": "describing",
                        "text": "Опишите, что вы видите",
                        "data": item.data
                    }

            return None

    async def set_player_ready(self, room_id: UUID, user_id: UUID):
        room = await self.get_room(room_id)
        if not room:
            return None

        if user_id not in room.players:
            return None

        if user_id not in room.ready_players:
            room.ready_players.append(user_id)

        await self.save_room(room)
        return room

    async def all_players_ready(self, room_id: UUID) -> bool:
        room = await self.get_room(room_id)
        if not room:
            return False

        if not room.players:
            return False

        return len(room.players) == len(room.ready_players)

    async def next_phase(self, room_id: UUID):
        room = await self.get_room(room_id)
        if not room:
            return None

        if room.phase == "writing":
            room.phase = "drawing"

        elif room.phase == "drawing":
            room.phase = "describing"

        elif room.phase == "describing":
            if room.round + 1 >= room.max_rounds:
                room.phase = "finished"
            else:
                room.phase = "drawing"
                room.round += 1

        room.ready_players = []
        await self.save_room(room)
        return room


game_manager = GameManager()