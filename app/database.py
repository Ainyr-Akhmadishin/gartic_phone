from typing import Annotated, AsyncGenerator

from fastapi import Depends
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.models import Users, Base

DATABASE_URL = "postgresql+asyncpg://postgres:12345@localhost:5432/gartic_phone"


engine = create_async_engine(DATABASE_URL)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def get_session()-> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as async_session:
        yield async_session

async def create_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

SessionDep = Annotated[AsyncSession, Depends(get_session)]

async def get_db_users(session: SessionDep):
    yield SQLAlchemyUserDatabase(session, Users)