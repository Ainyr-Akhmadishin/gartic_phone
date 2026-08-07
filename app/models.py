

from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase, SQLAlchemyBaseUserTableUUID
from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase, Mapped
from sqlalchemy.testing.schema import mapped_column


class Base(DeclarativeBase):
    pass

class Users(SQLAlchemyBaseUserTableUUID,Base):
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    pass