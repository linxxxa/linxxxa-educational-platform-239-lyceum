"""
Зависимости API: извлечение текущего пользователя из JWT.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_database_session_generator
from app.core.security import validate_provided_json_web_token

http_bearer_scheme = HTTPBearer(auto_error=False)


def _extract_user_identifier_from_bearer_token(
    credentials: HTTPAuthorizationCredentials | None,
) -> int | None:
    """
    Извлекает user_id из JWT в заголовке Authorization: Bearer <token>.
    Декодирование проверяет подпись — нельзя подделать ID.
    """
    if credentials is None:
        return None
    payload = validate_provided_json_web_token(credentials.credentials)
    if payload is None:
        return None
    sub_value = payload.get("sub")
    if sub_value is None:
        return None
    try:
        return int(sub_value)
    except (ValueError, TypeError):
        return None


def _fetch_user_account_by_identifier(
    database_session_instance: Session,
    user_unique_identifier: int,
):
    """Загружает UserAccountModel по ID. Возвращает None если не найден."""
    from sqlalchemy import select
    from app.models.user_account import UserAccountModel

    result = database_session_instance.execute(
        select(UserAccountModel).where(
            UserAccountModel.user_unique_identifier == user_unique_identifier
        )
    )
    return result.scalars().first()


def get_current_authorized_user_object(
    database_connection_session: Session = Depends(get_database_session_generator),
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer_scheme),
):
    """
    Извлекает токен из заголовка, проверяет валидность, возвращает UserAccountModel.
    Без Bearer-токена возвращает 401.
    """
    user_identifier = _extract_user_identifier_from_bearer_token(credentials)
    if user_identifier is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )
    authenticated_user_account_object = _fetch_user_account_by_identifier(
        database_connection_session, user_identifier
    )
    if authenticated_user_account_object is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )
    return authenticated_user_account_object
