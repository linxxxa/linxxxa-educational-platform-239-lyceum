"""
Зависимости FastAPI: извлечение текущего пользователя и др.
Пока используем заголовок X-User-Id; после внедрения JWT — заменить на токен.
"""
from fastapi import Request


def get_current_authorized_user_id_from_header(request: Request) -> int | None:
    """
    ID текущего авторизованного пользователя из заголовка X-User-Id.
    None — системная тема (до внедрения JWT — временное решение).
    """
    raw_value = request.headers.get("X-User-Id")
    if raw_value is None:
        return None
    try:
        return int(raw_value)
    except ValueError:
        return None
