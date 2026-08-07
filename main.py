from app.auth import fastapi_users

from fastapi import FastAPI

from app.auth import auth_backend
from app.database import engine, create_db
from app.game.gamemanager import game_manager
from app.schemas import UserRead, UserCreate, UserUpdate
from app.api.room import router as room_router
from app.api.connection import router as connection_router

async def lifespan(app: FastAPI):
    await create_db()
    print('Database created')
    await game_manager.init()
    yield

app = FastAPI(lifespan=lifespan)

app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)

app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)

app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)

app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)

app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

app.include_router(room_router)
app.include_router(connection_router)

app.frontend("/", directory="frontend", fallback="index.html")