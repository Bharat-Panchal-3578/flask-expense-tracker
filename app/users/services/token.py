from flask_jwt_extended import create_access_token, create_refresh_token
from app.extensions import db
from app.models.user import TokenBlacklist

def generate_tokens(user_id: int) -> tuple[str, str]:
    """Issue a fresh access + refresh token pair for a user."""
    access_token = create_access_token(identity=str(user_id))
    refresh_token = create_refresh_token(identity=str(user_id))

    return access_token, refresh_token

def blacklist_token(jti: str) -> None:
    """Persist a JTI to the blacklist table"""
    db.session.add(TokenBlacklist(jti=jti))
    db.session.commit()

def rotate_tokens(current_jti: str, user_id: str) -> tuple[str, str]:
    """Blacklist the current refresh token and issue new access + refresh token pair."""
    blacklist_token(current_jti)
    return generate_tokens(int(user_id))