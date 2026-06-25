import secrets
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User
from app.core import security
from app.core.config import settings

# auto_error=False so a missing Authorization header falls through to the
# API-key check below instead of short-circuiting with a 401.
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"/api/v1/access-token",
    auto_error=False,
)

def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(reusable_oauth2),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
) -> User:
    # Agent/MCP access: a valid static API key resolves to the single
    # configured user (this app is single-user, keyed by USER_EMAIL).
    if x_api_key is not None and settings.APPLYQUEST_API_KEY and secrets.compare_digest(
        x_api_key, settings.APPLYQUEST_API_KEY
    ):
        user = db.query(User).filter(User.email == settings.USER_EMAIL).first()
        if not user:
            raise HTTPException(
                status_code=404, detail="Configured USER_EMAIL user not found"
            )
        return user

    if not token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = payload.get("sub")
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = db.query(User).filter(User.id == token_data).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
