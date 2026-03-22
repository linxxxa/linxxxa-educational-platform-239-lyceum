"""
Зависимости API: извлечение текущего пользователя из JWT.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_database_session_generator
from app.core.security import decode_and_validate_json_web_token

# 1. OAuth2PasswordBearer извлекает токен из заголовка Authorization
oauth2_password_bearer_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def _extract_user_email_from_decoded_payload(
    decoded_token_payload_dictionary: dict | None,
) -> str | None:
    """Извлекает user_email_address из payload токена."""
    if decoded_token_payload_dictionary is None:
        return None
    return decoded_token_payload_dictionary.get("user_email_address")


def _fetch_user_account_by_email_address(
    database_session_instance: Session,
    user_email_address: str,
):
    """Загружает UserAccountModel по email. Возвращает None если не найден."""
    from sqlalchemy import select
    from app.models.user_account import UserAccountModel

    result = database_session_instance.execute(
        select(UserAccountModel).where(
            UserAccountModel.user_email_address == user_email_address
        )
    )
    return result.scalars().first()


def get_currently_authenticated_user_data(
    provided_token_string: str = Depends(oauth2_password_bearer_scheme),
    database_connection_session: Session = Depends(get_database_session_generator),
):
    """
    1. Извлекает токен (OAuth2PasswordBearer).
    2. Декодирует и проверяет подпись.
    3. Извлекает user_email_address из payload.
    4. Ищет пользователя в БД.
    5. При ошибке — HTTP 401.
    """
    decoded_token_payload_dictionary = decode_and_validate_json_web_token(
        provided_token_string
    )
    user_email_address = _extract_user_email_from_decoded_payload(
        decoded_token_payload_dictionary
    )
    if user_email_address is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный токен",
            headers={"WWW-Authenticate": "Bearer"},
        )
    authenticated_user_account_object = _fetch_user_account_by_email_address(
        database_connection_session, user_email_address
    )
    if authenticated_user_account_object is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )
    return authenticated_user_account_object


get_current_authorized_user_object = get_currently_authenticated_user_data
