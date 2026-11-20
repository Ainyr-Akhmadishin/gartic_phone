from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import OAuth2PasswordRequestForm

from app.auth import cookie_transport, get_long_lifetime, get_short_lifetime
from app.models import UserLogin
from app.usermanager import get_user_manager

router = APIRouter(prefix='/auth')
SHORT_TIME = 3600
LONG_TIME = 2590000


@router.post('/login')
async def login(
    user_login: UserLogin,
    response: Response,
    user_manager=Depends(get_user_manager),
):
    email = user_login.email
    password = user_login.password
    remember_me = user_login.remember_me

    form = OAuth2PasswordRequestForm(username=email, password=password)

    if remember_me:
        jwt_strategy = get_long_lifetime()
        max_age = LONG_TIME
    else:
        jwt_strategy = get_short_lifetime()
        max_age = SHORT_TIME

    user = await user_manager.authenticate(form)
    if user is None:
        raise HTTPException(status_code=401, detail='Could not validate credentials')

    token = await jwt_strategy.write_token(user)

    # Те же настройки cookies, что и в CookieTransport (включая logout).
    # Не задаём Domain: браузер привяжет cookie к тому адресу, с которого
    # открыт сайт. В Firefox это особенно важно для localhost / LAN IP.
    response.set_cookie(
        key=cookie_transport.cookie_name,
        value=token,
        max_age=max_age,
        path=cookie_transport.cookie_path,
        domain=cookie_transport.cookie_domain,
        secure=cookie_transport.cookie_secure,
        httponly=cookie_transport.cookie_httponly,
        samesite=cookie_transport.cookie_samesite,
    )
    return {
        'success': True,
        'remember_me': remember_me,
        'expires_in': max_age,
        'access_token': token,
    }
