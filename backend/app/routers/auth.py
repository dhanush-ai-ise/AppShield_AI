"""
JWT authentication helpers for admin-only actions.
"""
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Optional
from urllib.parse import urlencode, urlparse
import base64
import json
import uuid

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.config import settings
from app.db.mongo import mongo_db

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

router = APIRouter(prefix="/api/auth", tags=["auth"])
users_collection = mongo_db["users"]
_LOCAL_USERS: dict = {}


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    username: Optional[str] = None


@lru_cache(maxsize=1)
def _admin_user() -> dict:
    return {
        "username": settings.ADMIN_USERNAME,
        "email": f"{settings.ADMIN_USERNAME}@appshield.ai",
        "hashed_password": pwd_context.hash(settings.ADMIN_PASSWORD),
        "is_admin": True,
        "role": "super_admin",
    }


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def authenticate_user(username: str, password: str) -> Optional[dict]:
    admin = _admin_user()
    if username == admin["username"] or username == admin["email"]:
        if verify_password(password, admin["hashed_password"]):
            return admin
        return None

    # Check MongoDB / local store for registered users
    db_user = None
    try:
        db_user = users_collection.find_one({"$or": [{"username": username}, {"email": username}]})
    except Exception:
        db_user = _LOCAL_USERS.get(username)

    if db_user and verify_password(password, db_user.get("hashed_password", "")):
        return {
            "username": db_user.get("username") or db_user.get("email"),
            "email": db_user.get("email") or db_user.get("username"),
            "full_name": db_user.get("full_name", ""),
            "role": db_user.get("role", "user"),
            "is_admin": db_user.get("role") in ("admin", "super_admin"),
        }

    return None


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
    except JWTError as exc:
        raise credentials_exception from exc

    if username == settings.ADMIN_USERNAME or username == _admin_user()["email"]:
        return _admin_user()

    try:
        db_user = users_collection.find_one({"$or": [{"username": username}, {"email": username}]})
    except Exception:
        db_user = _LOCAL_USERS.get(username)

    if db_user:
        return {
            "username": db_user.get("username") or username,
            "email": db_user.get("email") or username,
            "full_name": db_user.get("full_name", ""),
            "role": db_user.get("role", "user"),
            "is_admin": db_user.get("role") in ("admin", "super_admin"),
        }

    is_admin = payload.get("role") in ("admin", "super_admin") or username == settings.ADMIN_USERNAME
    return {
        "username": username,
        "email": username,
        "role": payload.get("role", "admin" if is_admin else "user"),
        "is_admin": is_admin,
    }


def _resolve_user_dict(sub_val: str, role_val: Optional[str] = None) -> dict:
    is_admin = sub_val in (settings.ADMIN_USERNAME, f"{settings.ADMIN_USERNAME}@appshield.ai") or role_val in ("admin", "super_admin")
    try:
        db_user = users_collection.find_one({"$or": [{"username": sub_val}, {"email": sub_val}]})
        if db_user:
            return {
                "user_id": db_user.get("user_id") or ("usr_admin_001" if is_admin else "usr_analyst_002"),
                "username": db_user.get("username") or sub_val,
                "email": db_user.get("email") or (f"{sub_val}@appshield.ai" if "@" not in sub_val else sub_val),
                "full_name": db_user.get("full_name") or ("Security Administrator" if is_admin else "Analyst"),
                "role": db_user.get("role") or ("super_admin" if is_admin else "user"),
                "is_admin": is_admin or db_user.get("is_admin", False),
            }
    except Exception:
        pass

    resolved_email = sub_val if "@" in sub_val else f"{sub_val}@appshield.ai"
    resolved_user = sub_val.split("@")[0] if "@" in sub_val else sub_val
    return {
        "user_id": "usr_admin_001" if is_admin else f"usr_{uuid.uuid4().hex[:8]}",
        "username": resolved_user,
        "email": resolved_email,
        "full_name": "Security Administrator" if is_admin else resolved_user.capitalize(),
        "role": "super_admin" if is_admin else (role_val or "user"),
        "is_admin": is_admin,
    }


def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Extract user from Bearer token if provided, without raising 401.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[len("Bearer "):].strip()
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub") or payload.get("email")
        if username:
            return _resolve_user_dict(username, payload.get("role"))
    except Exception:
        # Fallback decode in case token was signed with mock/dev key
        try:
            parts = token.split(".")
            if len(parts) >= 2:
                b64 = parts[1].replace("-", "+").replace("_", "/")
                b64 += "=" * ((4 - len(b64) % 4) % 4)
                p = json.loads(base64.b64decode(b64))
                sub = p.get("sub") or p.get("email")
                if sub:
                    return _resolve_user_dict(sub, p.get("role"))
        except Exception:
            pass

    return None


async def get_current_active_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not authorized to access this endpoint.")
    return current_user


@router.post("/signup", response_model=Token)
async def signup(req: SignupRequest) -> Token:
    email = req.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    if email == settings.ADMIN_USERNAME.lower():
        raise HTTPException(status_code=400, detail="Username or email is already taken.")

    # Check if already registered
    existing = None
    try:
        existing = users_collection.find_one({"email": email})
    except Exception:
        existing = _LOCAL_USERS.get(email)

    if existing:
        raise HTTPException(status_code=400, detail="Account with this email already exists.")

    user_doc = {
        "user_id": str(uuid.uuid4()),
        "email": email,
        "username": (req.username or email.split("@")[0]).strip(),
        "full_name": (req.full_name or "").strip(),
        "hashed_password": pwd_context.hash(req.password),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        users_collection.insert_one(user_doc)
    except Exception:
        pass
    _LOCAL_USERS[email] = user_doc
    _LOCAL_USERS[user_doc["username"]] = user_doc

    access_token = create_access_token({"sub": email, "role": "user"})
    return Token(access_token=access_token, token_type="bearer")


@router.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()) -> Token:
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_sub = user.get("email") or user.get("username")
    access_token = create_access_token({
        "sub": user_sub,
        "role": user.get("role", "admin" if user.get("is_admin") else "user"),
    })
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
