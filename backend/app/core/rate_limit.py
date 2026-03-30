"""Ограничение частоты запросов по IP (slowapi)."""
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request


def get_real_ip(request: Request) -> str:
    """Учитывает X-Forwarded-For за прокси."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=get_real_ip)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    _ = request
    _ = exc
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Слишком много запросов с этого адреса. Попробуйте позже."
        },
    )
