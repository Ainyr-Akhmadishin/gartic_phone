import uuid

from fastapi_users import FastAPIUsers
from fastapi_users.authentication import CookieTransport, JWTStrategy, BearerTransport
from fastapi_users.authentication import AuthenticationBackend
from sqlalchemy.testing.pickleable import User

from app.models import Users
from app.usermanager import get_user_manager

cookie_transport = CookieTransport(
    cookie_name='gartic',
    cookie_max_age=3600,
    cookie_domain='127.0.0.1',
    cookie_path='/',
)

SECRET="SECRET"

def get_jwt_strategy()->JWTStrategy:
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)


auth_backend = AuthenticationBackend(
    name = 'jwt',
    get_strategy=get_jwt_strategy,
    transport=cookie_transport
)


fastapi_users = FastAPIUsers[Users, uuid.UUID](
    get_user_manager=get_user_manager,
    auth_backends=[auth_backend]
)

current_user = fastapi_users.current_user(active=True)