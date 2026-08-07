from http.client import HTTPException
from uuid import UUID

from starlette.websockets import WebSocket


class ConnectionManager:
    def __init__(self):
        self.rooms = {}

    async def connect(self, room_id: UUID, user_id: UUID, websocket: WebSocket):
        await websocket.accept()

        if room_id in self.rooms:
            self.rooms[room_id][user_id] = websocket
        else:
            self.rooms[room_id] = {user_id: websocket}

    async def disconnect(self, room_id: UUID, user_id: UUID):
        if room_id not in self.rooms:
            return

        connection = self.rooms[room_id].pop(user_id)

        if connection:
            await connection.close()

        if not self.rooms[room_id]:
            del self.rooms[room_id]

    async def broadcast(self, message: dict, room_id: UUID, sender_id: UUID):
        if (room_id not in self.rooms) or (sender_id not in self.rooms[room_id]):
            return


        for user_id, connection in self.rooms[room_id].items():
            if user_id != sender_id:
                await connection.send_json(message)

    async def send_personal_message(self, message: dict, room_id: UUID, recipient_id: UUID):
        if (room_id not in self.rooms) or (recipient_id not in self.rooms[room_id]):
            return

        recipient_connection = self.rooms[room_id][recipient_id]
        if recipient_connection:
            await recipient_connection.send_json(message)

    async def get_users_in_room(self, room_id: UUID) -> list[UUID]:
        if room_id not in self.rooms:
            return []
        return list(self.rooms[room_id].keys())


connection_manager = ConnectionManager()







