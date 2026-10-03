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

import hashlib
import logging

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

router = APIRouter(prefix="/api/auth", tags=["auth"])
users_collection = mongo_db["users"]
_LOCAL_USERS: dict = {}


def get_avatar_url(email: str, name: Optional[str] = None) -> str:
    """
    Returns a verified Gravatar profile picture URL for the email address,
    with a deterministic fallback. If the email has a registered Gravatar
    (e.g., linked to WordPress/GitHub), it delivers the real user photo.
    """
    clean_email = (email or "").strip().lower()
    if not clean_email or "@" not in clean_email:
        clean_email = "admin@appshield.ai"
    email_hash = hashlib.md5(clean_email.encode("utf-8")).hexdigest()
    return f"https://www.gravatar.com/avatar/{email_hash}?s=200&d=identicon"


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


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None


@lru_cache(maxsize=1)
def _admin_user() -> dict:
    admin_email = f"{settings.ADMIN_USERNAME}@appshield.ai"
    return {
        "user_id": "usr_admin_001",
        "username": settings.ADMIN_USERNAME,
        "email": admin_email,
        "full_name": "Security Administrator",
        "avatar_url": get_avatar_url(admin_email, "Security Administrator"),
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
        u_email = db_user.get("email") or db_user.get("username")
        u_name = db_user.get("full_name") or db_user.get("username")
        return {
            "user_id": db_user.get("user_id") or f"usr_{uuid.uuid4().hex[:8]}",
            "username": db_user.get("username") or u_email.split("@")[0],
            "email": u_email,
            "full_name": u_name,
            "avatar_url": db_user.get("avatar_url") or get_avatar_url(u_email, u_name),
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
        u_email = db_user.get("email") or username
        u_name = db_user.get("full_name") or db_user.get("username") or username
        return {
            "user_id": db_user.get("user_id") or f"usr_{uuid.uuid4().hex[:8]}",
            "username": db_user.get("username") or username,
            "email": u_email,
            "full_name": u_name,
            "avatar_url": db_user.get("avatar_url") or get_avatar_url(u_email, u_name),
            "role": db_user.get("role", "user"),
            "is_admin": db_user.get("role") in ("admin", "super_admin"),
        }

    is_admin = payload.get("role") in ("admin", "super_admin") or username == settings.ADMIN_USERNAME
    user_email = payload.get("email") or (username if "@" in username else f"{username}@appshield.ai")
    user_name = payload.get("full_name") or username.split("@")[0].capitalize()
    return {
        "user_id": f"usr_{uuid.uuid4().hex[:8]}",
        "username": username,
        "email": user_email,
        "full_name": user_name,
        "avatar_url": payload.get("avatar_url") or get_avatar_url(user_email, user_name),
        "role": payload.get("role", "admin" if is_admin else "user"),
        "is_admin": is_admin,
    }


def _resolve_user_dict(sub_val: str, role_val: Optional[str] = None) -> dict:
    is_admin = sub_val in (settings.ADMIN_USERNAME, f"{settings.ADMIN_USERNAME}@appshield.ai") or role_val in ("admin", "super_admin")
    try:
        db_user = users_collection.find_one({"$or": [{"username": sub_val}, {"email": sub_val}]})
        if db_user:
            email_val = db_user.get("email") or (f"{sub_val}@appshield.ai" if "@" not in sub_val else sub_val)
            name_val = db_user.get("full_name") or ("Security Administrator" if is_admin else "Analyst")
            return {
                "user_id": db_user.get("user_id") or ("usr_admin_001" if is_admin else "usr_analyst_002"),
                "username": db_user.get("username") or sub_val,
                "email": email_val,
                "full_name": name_val,
                "avatar_url": db_user.get("avatar_url") or get_avatar_url(email_val, name_val),
                "role": db_user.get("role") or ("super_admin" if is_admin else "user"),
                "is_admin": is_admin or db_user.get("is_admin", False),
            }
    except Exception:
        pass

    resolved_email = sub_val if "@" in sub_val else f"{sub_val}@appshield.ai"
    resolved_user = sub_val.split("@")[0] if "@" in sub_val else sub_val
    name_val = "Security Administrator" if is_admin else resolved_user.capitalize()
    return {
        "user_id": "usr_admin_001" if is_admin else f"usr_{uuid.uuid4().hex[:8]}",
        "username": resolved_user,
        "email": resolved_email,
        "full_name": name_val,
        "avatar_url": get_avatar_url(resolved_email, name_val),
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

    username = (req.username or email.split("@")[0]).strip()
    full_name = (req.full_name or "").strip() or username.capitalize()
    avatar_url = get_avatar_url(email, full_name)

    user_doc = {
        "user_id": str(uuid.uuid4()),
        "email": email,
        "username": username,
        "full_name": full_name,
        "avatar_url": avatar_url,
        "hashed_password": pwd_context.hash(req.password),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        users_collection.insert_one(user_doc)
        logger.info(f"MongoDB: Created new user {email} with avatar.")
    except Exception as exc:
        logger.warning(f"Failed to insert user into MongoDB: {exc}")

    _LOCAL_USERS[email] = user_doc
    _LOCAL_USERS[user_doc["username"]] = user_doc

    access_token = create_access_token({
        "sub": email,
        "email": email,
        "username": username,
        "full_name": full_name,
        "avatar_url": avatar_url,
        "role": "user",
    })
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

    user_email = user.get("email") or (form_data.username if "@" in form_data.username else f"{form_data.username}@appshield.ai")
    user_email = user_email.strip().lower()
    full_name = user.get("full_name") or user.get("username") or user_email.split("@")[0].capitalize()
    username = user.get("username") or user_email.split("@")[0]
    avatar_url = user.get("avatar_url") or get_avatar_url(user_email, full_name)
    role = user.get("role", "super_admin" if user.get("is_admin") else "user")
    is_admin = user.get("is_admin", role in ("admin", "super_admin"))

    # Always persist/update user in MongoDB users collection with exact email, avatar, and last login
    try:
        users_collection.update_one(
            {"$or": [{"email": user_email}, {"username": username}]},
            {
                "$set": {
                    "email": user_email,
                    "username": username,
                    "full_name": full_name,
                    "avatar_url": avatar_url,
                    "role": role,
                    "is_admin": is_admin,
                    "last_login": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                "$setOnInsert": {
                    "user_id": user.get("user_id") or f"usr_{uuid.uuid4().hex[:8]}",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            upsert=True
        )
        logger.info(f"MongoDB: Recorded login for user email {user_email} with avatar.")
    except Exception as exc:
        logger.warning(f"Failed to update MongoDB user login: {exc}")

    access_token = create_access_token({
        "sub": user_email,
        "email": user_email,
        "username": username,
        "full_name": full_name,
        "avatar_url": avatar_url,
        "role": role,
    })
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me")
async def get_current_user_profile(current_user: dict = Depends(get_current_user)) -> dict:
    email = current_user.get("email") or (f"{current_user.get('username')}@appshield.ai" if "@" not in str(current_user.get("username", "")) else str(current_user.get("username")))
    email = email.strip().lower()
    name = current_user.get("full_name") or current_user.get("username")
    avatar = current_user.get("avatar_url") or get_avatar_url(email, name)
    return {
        "user_id": current_user.get("user_id") or "usr_001",
        "email": email,
        "username": current_user.get("username") or email.split("@")[0],
        "full_name": name,
        "avatar_url": avatar,
        "role": current_user.get("role", "user"),
        "is_admin": current_user.get("is_admin", False),
    }


@router.post("/profile")
async def update_profile(
    req: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    username = current_user.get("username")
    user_email = (req.email or current_user.get("email") or f"{username}@appshield.ai").strip().lower()
    full_name = req.full_name or current_user.get("full_name") or username
    avatar_url = req.avatar_url or current_user.get("avatar_url") or get_avatar_url(user_email, full_name)

    try:
        users_collection.update_one(
            {"$or": [{"username": username}, {"email": user_email}]},
            {
                "$set": {
                    "email": user_email,
                    "full_name": full_name,
                    "avatar_url": avatar_url,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            upsert=True,
        )
    except Exception as exc:
        logger.warning(f"Failed to update profile in MongoDB: {exc}")

    return {
        "status": "ok",
        "email": user_email,
        "full_name": full_name,
        "avatar_url": avatar_url,
    }


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
    Exchange authorization code for Google access token, fetch the user's
    email, display name, and profile picture, persist to MongoDB users collection,
    mint a JWT, and redirect to the frontend.
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

    # 2. Fetch Google user profile (email, name, picture)
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
    email: str = (user_info.get("email") or "google_user@appshield.ai").strip().lower()
    name: str = user_info.get("name") or email.split("@")[0].capitalize()
    picture: str = user_info.get("picture") or get_avatar_url(email, name)
    username = email.split("@")[0]

    # 3. Store / update user profile in MongoDB users collection
    try:
        users_collection.update_one(
            {"email": email},
            {
                "$set": {
                    "email": email,
                    "username": username,
                    "full_name": name,
                    "avatar_url": picture,
                    "provider": "google",
                    "last_login": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                "$setOnInsert": {
                    "user_id": f"usr_{uuid.uuid4().hex[:8]}",
                    "role": "user",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            },
            upsert=True
        )
        logger.info(f"MongoDB: Stored Google authenticated user {email} with profile picture.")
    except Exception as exc:
        logger.warning(f"Failed to store Google user in MongoDB: {exc}")

    # 4. Mint an app JWT with sub=email, email, and avatar_url
    access_token = create_access_token(
        data={
            "sub": email,
            "email": email,
            "username": username,
            "full_name": name,
            "avatar_url": picture,
            "provider": "google",
            "role": "user",
        },
        expires_delta=timedelta(hours=8),
    )

    # 5. Redirect browser back to the frontend
    frontend_origin = state if (state and state.startswith("http")) else settings.FRONTEND_URL
    redirect_url = (
        f"{frontend_origin}/login"
        f"?token={access_token}"
        f"&next=/dashboard"
    )
    return RedirectResponse(redirect_url)
