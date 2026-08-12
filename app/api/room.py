from uuid import uuid4, UUID
from fastapi import APIRouter, HTTPException, Depends
from app.auth import current_user
from app.models import Users
from app.game.gamemanager import game_manager
from app.websocket.manager import connection_manager
from app.api.connection import distribute_tasks

router = APIRouter(prefix="/game/rooms", tags=["game"])


@router.post('')
async def create_room(user: Users = Depends(current_user)):
    room_id = uuid4()
    room = await game_manager.create_room(room_id, user.id)
    return room


@router.get('/{room_id}')
async def get_room(room_id: UUID):
    room = await game_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.post('/{room_id}/join')
async def add_player(room_id: UUID, user: Users = Depends(current_user)):
    room = await game_manager.add_player(room_id, user.id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.post('/{room_id}/start')
async def start_room(room_id: UUID, user: Users = Depends(current_user)):
    room = await game_manager.start_game(room_id, user.id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    await connection_manager.broadcast(
        message={
            "type": "game_started",
            "phase": room.phase,
            "players": [str(p) for p in room.players]
        },
        room_id=room.room_id,
        sender_id=None
    )

    await distribute_tasks(room)

    return room