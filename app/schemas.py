import uuid

from fastapi_users import schemas
from pydantic import BaseModel, Field


class UserRead(schemas.BaseUser[uuid.UUID]):
    username: str = Field(max_length=50)
    pass


class UserCreate(schemas.BaseUserCreate):
    username: str = Field(max_length=50)
    pass


class UserUpdate(schemas.BaseUserUpdate):
    username: str = Field(max_length=50)
    pass