"""
JWT authentication helpers for admin-only actions.
"""
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Optional
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.config import settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


@lru_cache(maxsize=1)
def _admin_user() -> dict:
    return {
        "username": settings.ADMIN_USERNAME,
        "hashed_password": pwd_context.hash(settings.ADMIN_PASSWORD),
        "is_admin": True,
    }


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def authenticate_user(username: str, password: str) -> Optional[dict]:
    user = _admin_user()
    if username != user["username"]:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError as exc:
        raise credentials_exception from exc

    user = _admin_user()
    if token_data.username != user["username"]:
        raise credentials_exception
    return user


async def get_current_active_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not authorized to access this endpoint.")
    return current_user


@router.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()) -> Token:
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token({"sub": user["username"]})
    return Token(access_token=access_token, token_type="bearer")


# ---------------------------------------------------------------------------
# Google OAuth 2.0
# ---------------------------------------------------------------------------
_GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google", summary="Redirect to Google OAuth consent page")
def google_login(request: Request, origin: Optional[str] = None) -> RedirectResponse:
    """Send the browser to Google's OAuth 2.0 consent screen."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth is not configured on this server.",
        )
    
    # Determine initiating frontend origin so callback returns to the correct frontend port
    target_origin = origin
    if not target_origin:
        referer = request.headers.get("referer")
        if referer:
            parsed = urlparse(referer)
            if parsed.scheme and parsed.netloc:
                target_origin = f"{parsed.scheme}://{parsed.netloc}"
    
    if not target_origin:
        target_origin = settings.FRONTEND_URL

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": target_origin,
    }
    return RedirectResponse(f"{_GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}")


@router.get("/google/callback", summary="Handle Google OAuth callback")
async def google_callback(code: str, state: Optional[str] = None) -> RedirectResponse:
    """
    Exchange the authorization code Google sends back for an access token,
    fetch the user's profile, mint an app JWT and redirect the browser to
    the frontend login page with the token embedded in the URL parameters.
    """
    # 1. Exchange code for Google access token
    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.post(
            _GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google token exchange failed: {token_resp.text}",
        )

    google_token = token_resp.json().get("access_token")

    # 2. Fetch Google user profile
    async with httpx.AsyncClient(timeout=10) as client:
        userinfo_resp = await client.get(
            _GOOGLE_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {google_token}"},
        )

    if userinfo_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch user info from Google.",
        )

    user_info = userinfo_resp.json()
    email: str = user_info.get("email", "google_user")

    # 3. Mint an app JWT using the Google email as the subject
    access_token = create_access_token(
        data={"sub": email, "provider": "google"},
        expires_delta=timedelta(hours=8),
    )

    # 4. Redirect browser back to the frontend origin that initiated login
    frontend_origin = state if (state and state.startswith("http")) else settings.FRONTEND_URL
    redirect_url = (
        f"{frontend_origin}/login"
        f"?token={access_token}"
        f"&next=/dashboard"
    )
    return RedirectResponse(redirect_url)
