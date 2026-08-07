from app.auth import fastapi_users

from fastapi import FastAPI

from app.auth import auth_backend
from app.database import engine, create_db
from app.schemas import UserRead, UserCreate, UserUpdate


async def lifespan(app: FastAPI):
    await create_db()
    print('Database created')
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

app.frontend("/", directory="frontend", fallback="index.html")