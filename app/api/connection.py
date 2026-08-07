from uuid import UUID

from fastapi import APIRouter, Depends
from starlette.websockets import WebSocket, WebSocketDisconnect

from app.auth import current_user
from app.game.gamemanager import game_manager
from app.models import Users
from app.websocket.manager import connection_manager


router = APIRouter()
@router.websocket('/ws/{room_id}')
async def connection(room_id: UUID, websocket: WebSocket):
    user_id_str = websocket.query_params.get("user_id")

    if not user_id_str:
        await websocket.close(code=1008, reason="user_id required")
        return

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        await websocket.close(code=1008, reason="Invalid user_id")
        return

    room = await game_manager.get_room(room_id)
    if not room:
        await websocket.close(code=1008, reason="Room not found")
        return

    if user_id not in room.players:
        await websocket.close(code=1008, reason="You are not in this room")
        return

    await connection_manager.connect(room_id=room_id, user_id=user_id, websocket=websocket)

    try:
        while True:
            data = await websocket.receive_json()
            await connection_manager.broadcast(room_id=room_id, message=data, sender_id=user_id)
    except WebSocketDisconnect:
        connection_manager.disconnect(room_id=room_id, user_id=user_id)


