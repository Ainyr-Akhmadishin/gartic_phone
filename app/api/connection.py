from uuid import UUID

from fastapi import APIRouter
from starlette.websockets import WebSocket, WebSocketDisconnect

from app.game.gamemanager import game_manager
from app.game.room import ChainItem, Room
from app.websocket.manager import connection_manager


async def distribute_tasks(room: Room):
    for player in room.players:
        if room.phase == "finished":
            history = {
                owner_id: [
                    item.model_dump()
                    for item in items
                ]
                for owner_id, items in room.history.items()
            }
            # history_serializable = [item.model_dump() for item in history]

            await connection_manager.send_personal_message(
                message={
                    "type": "game_finished",
                    "phase": "finished",
                    "history": history
                },
                room_id=room.room_id,
                recipient_id=player
            )
            continue

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


@router.websocket("/ws/{room_id}")
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

            message_type = data.get("type")

            if message_type == "phrase":
                if room.phase != "writing":
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "Сейчас не фаза writing"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                text = data.get("text")

                if not text or not str(text).strip():
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "Нет текста фразы"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                item = ChainItem(
                    type="phrase",
                    text=text.strip(),
                    round=room.round,
                    original_owner=str(user_id),
                    player_id=str(user_id)
                )

                await game_manager.add_to_chain(room_id, user_id, item)
                await game_manager.set_player_ready(room_id, user_id)

                if await game_manager.all_players_ready(room_id):
                    updated_room = await game_manager.next_phase(room_id)

                    if updated_room:
                        await distribute_tasks(updated_room)

            elif message_type == "drawing":
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

                prev_chain = room.chain.get(str(prev_user), [])

                if not prev_chain:
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "У предыдущего игрока нет цепочки"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                source_item = next(
                    (chain_item for chain_item in reversed(prev_chain) if chain_item.round == room.round - 1),
                    None
                )

                if source_item is None:
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": f"Не найден предыдущий элемент цепочки для round={room.round}"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                original_owner = source_item.original_owner

                if not original_owner:
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "У предыдущего элемента отсутствует original_owner"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                item = ChainItem(
                    type="drawing",
                    data=drawing_data,
                    round=room.round,
                    original_owner=original_owner,
                    player_id=str(user_id)
                )

                await game_manager.add_to_chain(room_id, user_id, item)
                await game_manager.set_player_ready(room_id, user_id)

                if await game_manager.all_players_ready(room_id):
                    updated_room = await game_manager.next_phase(room_id)

                    if updated_room:
                        await distribute_tasks(updated_room)

            elif message_type == "description":
                if room.phase != "describing":
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "Сейчас не фаза описания"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                text = data.get("text")

                if not text or not str(text).strip():
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "Нет текста описания"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                prev_user = await game_manager.get_previous_player(room, user_id)

                if prev_user is None:
                    continue

                prev_chain = room.chain.get(str(prev_user), [])

                if not prev_chain:
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "У предыдущего игрока нет цепочки"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                source_item = next(
                    (chain_item for chain_item in reversed(prev_chain) if chain_item.round == room.round - 1),
                    None
                )

                if source_item is None:
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": f"Не найден предыдущий элемент цепочки для round={room.round}"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                original_owner = source_item.original_owner

                if not original_owner:
                    await connection_manager.send_personal_message(
                        message={"type": "error", "text": "У предыдущего элемента отсутствует original_owner"},
                        room_id=room_id,
                        recipient_id=user_id
                    )
                    continue

                item = ChainItem(
                    type="description",
                    text=text.strip(),
                    round=room.round,
                    original_owner=original_owner,
                    player_id=str(user_id)
                )

                await game_manager.add_to_chain(room_id, user_id, item)
                await game_manager.set_player_ready(room_id, user_id)

                if await game_manager.all_players_ready(room_id):
                    updated_room = await game_manager.next_phase(room_id)

                    if updated_room:
                        await distribute_tasks(updated_room)

            elif message_type == "ready":
                await game_manager.set_player_ready(room_id, user_id)

                if await game_manager.all_players_ready(room_id):
                    updated_room = await game_manager.next_phase(room_id)

                    if updated_room:
                        await distribute_tasks(updated_room)

            else:
                await connection_manager.send_personal_message(
                    message={"type": "error", "text": f"Неизвестный тип сообщения: {message_type}"},
                    room_id=room_id,
                    recipient_id=user_id
                )

    except WebSocketDisconnect:
        await connection_manager.disconnect(room_id=room_id, user_id=user_id)

    except Exception as e:
        print(f"WebSocket error: {e}")
        import traceback
        traceback.print_exc()
        await connection_manager.disconnect(room_id=room_id, user_id=user_id)