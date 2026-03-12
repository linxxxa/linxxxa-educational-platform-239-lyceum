"""
Безопасность: хэширование паролей (bcrypt) и JWT.
Декодирование токена проверяет подпись — нельзя подделать ID.
Безопаснее, чем передавать user_id в открытом виде.
"""
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone

from app.core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY_FOR_JWT_SIGNING,
)


def hash_plain_text_password_with_bcrypt(plain_text_password: str) -> str:
    """Хэширует пароль перед сохранением в БД."""
    salt_bytes = bcrypt.gensalt()
    password_bytes = plain_text_password.encode("utf-8")
    hashed_bytes = bcrypt.hashpw(password_bytes, salt_bytes)
    return hashed_bytes.decode("utf-8")


def verify_plain_password_against_bcrypt_hash(
    plain_text_password: str, stored_hashed_password: str
) -> bool:
    """Проверяет совпадение пароля с хешем в БД."""
    return bcrypt.checkpw(
        plain_text_password.encode("utf-8"),
        stored_hashed_password.encode("utf-8"),
    )


def create_encrypted_access_token_string(user_unique_identifier: int) -> str:
    """
    Создаёт JWT. В payload — sub (user_id).
    Подпись защищает от подделки; без секрета изменить ID нельзя.
    """
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_unique_identifier),
        "exp": expires_at,
    }
    return jwt.encode(
        payload, SECRET_KEY_FOR_JWT_SIGNING, algorithm=ALGORITHM
    )


def validate_provided_json_web_token(encrypted_token_string: str) -> dict | None:
    """
    Декодирует и валидирует JWT. Проверяет подпись и срок действия.
    Безопаснее передачи ID в заголовке — подделка без секрета невозможна.
    Возвращает payload или None при ошибке.
    """
    try:
        payload = jwt.decode(
            encrypted_token_string,
            SECRET_KEY_FOR_JWT_SIGNING,
            algorithms=[ALGORITHM],
        )
        return payload
    except jwt.PyJWTError:
        return None
