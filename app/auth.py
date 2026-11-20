import os
import uuid

from fastapi_users import FastAPIUsers
from fastapi_users.authentication import AuthenticationBackend, CookieTransport, JWTStrategy

from app.models import Users
from app.usermanager import get_user_manager

# Для локального запуска по HTTP (localhost, 127.0.0.1, IP в локальной сети)
# COOKIE_SECURE=False. На публичном HTTPS-сервере установите
# переменную окружения GARTIC_COOKIE_SECURE=true перед запуском.
COOKIE_SECURE = os.getenv('GARTIC_COOKIE_SECURE', 'false').strip().lower() in (
    '1', 'true', 'yes', 'on'
)

cookie_transport = CookieTransport(
    cookie_name='gartic',
    cookie_max_age=3600,
    cookie_domain=None,  # Host-only cookie: одинаково для localhost, 127.0.0.1 и IP
    cookie_path='/',
    cookie_secure=COOKIE_SECURE,
    cookie_httponly=True,
    cookie_samesite='lax',
)

SECRET = 'SECRET'  # Не использовать такой ключ для реального публичного сервиса.


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)


def get_long_lifetime() -> JWTStrategy:
    return JWTStrategy(secret=SECRET, lifetime_seconds=2590000)


def get_short_lifetime() -> JWTStrategy:
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)


auth_backend = AuthenticationBackend(
    name='jwt',
    get_strategy=get_jwt_strategy,
    transport=cookie_transport,
)

fastapi_users = FastAPIUsers[Users, uuid.UUID](
    get_user_manager=get_user_manager,
    auth_backends=[auth_backend],
)

current_user = fastapi_users.current_user(active=True)
