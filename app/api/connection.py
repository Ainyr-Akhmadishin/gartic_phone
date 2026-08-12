from uuid import UUID
from fastapi import APIRouter, Depends
from starlette.websockets import WebSocket, WebSocketDisconnect

from app.auth import current_user
from app.game.gamemanager import game_manager
from app.game.room import ChainItem, Room
from app.models import Users
from app.websocket.manager import connection_manager


async def distribute_tasks(room: Room):
    for player in room.players:
        task = await game_manager.get_task_for_user(room, player)
        if task:
            await connection_manager.send_personal_message(
                message={
                    "type": "task",
                    "phase": room.phase,
                    "task": task
                },
                room_id=room.room_id,
                recipient_id=player
            )


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

            room = await game_manager.get_room(room_id)
            if not room:
                break

            if data['type'] == "phrase":
                if room.phase != "writing":
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "Сейчас не фаза writing"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                text = data.get("text")
                if not text:
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "Нет текста фразы"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                item = ChainItem(
                    type="phrase",
                    text=text,
                    round=room.round
                )
                await game_manager.add_to_chain(room_id, user_id, item)

                await game_manager.set_player_ready(room_id, user_id)

                if await game_manager.all_players_ready(room_id):
                    updated_room = await game_manager.next_phase(room_id)
                    if updated_room:
                        await distribute_tasks(updated_room)

            elif data['type'] == "drawing":
                if room.phase != "drawing":
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "Сейчас не фаза рисования"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                drawing_data = data.get("data")
                if not drawing_data:
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "Нет данных рисунка"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                prev_user = await game_manager.get_previous_player(room, user_id)
                if prev_user is None:
                    continue

                item = ChainItem(
                    type="drawing",
                    data=drawing_data,
                    round=room.round
                )
                await game_manager.add_to_chain(room_id, prev_user, item)

                await game_manager.set_player_ready(room_id, user_id)

                if await game_manager.all_players_ready(room_id):
                    updated_room = await game_manager.next_phase(room_id)
                    if updated_room:
                        await distribute_tasks(updated_room)

            elif data['type'] == "description":
                if room.phase != "describing":
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "Сейчас не фаза описания"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                text = data.get("text")
                if not text:
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "Нет текста описания"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                prev_user = await game_manager.get_previous_player(room, user_id)
                if prev_user is None:
                    continue

                item = ChainItem(
                    type="description",
                    text=text,
                    round=room.round
                )
                await game_manager.add_to_chain(room_id, prev_user, item)

                await game_manager.set_player_ready(room_id, user_id)

                if await game_manager.all_players_ready(room_id):
                    updated_room = await game_manager.next_phase(room_id)
                    if updated_room:
                        await distribute_tasks(updated_room)

            elif data['type'] == "ready":
                await game_manager.set_player_ready(room_id, user_id)

                if await game_manager.all_players_ready(room_id):
                    updated_room = await game_manager.next_phase(room_id)
                    if updated_room:
                        await distribute_tasks(updated_room)

    except WebSocketDisconnect:
        connection_manager.disconnect(room_id=room_id, user_id=user_id)
    except Exception as e:
        print(f"{e}")
        import traceback
        traceback.print_exc()