from fastapi import APIRouter, HTTPException, Depends
from fastapi import Response
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_users.authentication import CookieTransport, JWTStrategy
from sqlalchemy.sql.functions import user

from app import usermanager
from app.auth import cookie_transport, get_long_lifetime, get_short_lifetime, current_user
from app.models import UserLogin
from app.usermanager import UserManager, get_user_manager

router = APIRouter(
    prefix="/auth",
)

SHORT_TIME = 3600
LONG_TIME = 2590000



@router.post('/login')
async def login(user_login: UserLogin, response: Response, user_manager=Depends(get_user_manager),):
    email = user_login.email
    password = user_login.password
    remember_me = user_login.remember_me

    form = OAuth2PasswordRequestForm(
        username=email,
        password=password
    )

    if remember_me:

        jwt_strategy = get_long_lifetime()

        max_age = LONG_TIME
    else:

        jwt_strategy = get_short_lifetime()

        max_age =  SHORT_TIME

    user = await user_manager.authenticate(form)

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
        )

    token = await jwt_strategy.write_token(user)

    response.set_cookie(
        key='gartic',
        value=token,
        max_age=max_age,
        domain='127.0.0.1',
        path='/',
    )

    return {
        "success": True,
        "remember_me": remember_me,
        "expires_in": max_age,
        "access_token": token
    }