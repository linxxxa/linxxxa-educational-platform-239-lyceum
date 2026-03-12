"""
Безопасность: хэширование паролей (passlib/bcrypt) и JWT (python-jose).
От получения пароля до подписи JWT: хеш → хранение в БД → верификация при входе →
формирование payload → подпись секретом → возврат токена.
"""
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt

from app.core.config import (
    ACCESS_TOKEN_EXPIRATION_MINUTES,
    ALGORITHM_TYPE,
    SECRET_KEY_FOR_JWT_SIGNING,
)

# Контекст passlib: алгоритм bcrypt для хэширования паролей
password_hashing_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_plain_text_password_with_bcrypt(plain_text_password: str) -> str:
    """
    Хэширует пароль перед сохранением в БД.
    Этап 1: plain text → bcrypt hash (salt + rounds).
    """
    return password_hashing_context.hash(plain_text_password)


def verify_plain_password_against_bcrypt_hash(
    provided_password_string_to_verify: str,
    hashed_password_from_database: str,
) -> bool:
    """
    Проверяет совпадение введённого пароля с хешем из БД.
    Этап 2: compare(plain, hash) без раскрытия пароля.
    """
    return password_hashing_context.verify(
        provided_password_string_to_verify, hashed_password_from_database
    )


def create_access_token_for_user_account(
    user_email_address: str,
) -> str:
    """
    Генерирует JWT для пользователя.
    Этап 3–4: payload (email, exp) → подпись SECRET_KEY.
    """
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRATION_MINUTES
    )
    payload = {
        "user_email_address": user_email_address,
        "exp": expires_at,
    }
    return jwt.encode(
        payload,
        SECRET_KEY_FOR_JWT_SIGNING,
        algorithm=ALGORITHM_TYPE,
    )


def decode_and_validate_json_web_token(encrypted_token_string: str) -> dict | None:
    """
    Декодирует JWT, проверяет подпись и срок действия.
    Возвращает decoded_token_payload_dictionary или None при ошибке.
    """
    try:
        decoded_token_payload_dictionary = jwt.decode(
            encrypted_token_string,
            SECRET_KEY_FOR_JWT_SIGNING,
            algorithms=[ALGORITHM_TYPE],
        )
        return decoded_token_payload_dictionary
    except JWTError:
        return None
