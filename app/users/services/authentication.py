import re
import logging
from flask_jwt_extended import decode_token
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models.user import User
from app.users.services.token import generate_tokens, blacklist_token

logger = logging.getLogger("api.users")

def _validate_username(username: str) -> str:
    username = username.strip()

    if not username:
        raise ValueError("username is required")
    
    if re.match(r".+@.+\..+", username):
        raise ValueError("username cannot look like an email")
    
    if "@" in username:
        raise ValueError("username cannot contain '@' symbol")
    
    return username

def _validate_email(email: str) -> str:
    email = email.strip().lower()

    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise ValueError("Enter a valid email address")
    
    return email

def _validate_password(password: str) -> str:
    if not password or (len(password) < 8):
        raise ValueError("password must be at least 8 characters")
    
    return password

def register_user(*, username: str, email: str, password: str) -> tuple[User, str, str]:
    """
    Validate fields, create user and issue tokens.
    Raises ValueError on any validation or uniqueness failure.
    """

    username = _validate_username(username)
    email = _validate_email(email)
    password = _validate_password(password)
    
    user = User(username=username, email=email)
    user.set_password(password)
    try:
        db.session.add(user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ValueError("Username or email already exists")

    logger.info("User registration successful", extra={"user_id": user.id, "username": user.username})
    access_token, refresh_token = generate_tokens(user.id)

    return user, access_token, refresh_token

def login_user(*, identifier: str, password: str) -> tuple[User, str, str]:
    """
    Accepts username or email as identifier.
    Raises ValueError on invalid credentials.
    """
    identifier = identifier.strip()

    if not identifier or not password:
        raise ValueError("Identifier and password are required")
    
    if "@" in identifier:
        user = User.query.filter_by(email=identifier.lower()).first()
    else:
        user = User.query.filter_by(username=identifier).first()

    if not user or not user.check_password(password):
        logger.warning("Login failed - Invalid credentials", extra={"identifier": identifier})
        raise ValueError("Invalid credentials")
    
    logger.info("User login successful", extra={"user_id": user.id})
    access_token, refresh_token = generate_tokens(user.id)

    return user, access_token, refresh_token

def logout_user(*, refresh_token: str) -> None:
    """
    Decode the refresh token, verify it, then blacklist its JTI.
    Raises ValueError if token is invalid or already expired.
    """

    try:
        decoded = decode_token(refresh_token)
        jti = decoded["jti"]
    except Exception:
        logger.warning("Logout failed - invalid or expired refresh token")
        raise ValueError("Invalid or expired refresh token")
    
    blacklist_token(jti)
    logger.info("User logout successful")