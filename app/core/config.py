"""Конфигурация приложения (секреты, таймауты)."""
import os

ALGORITHM_TYPE = "HS256"
ACCESS_TOKEN_EXPIRATION_MINUTES = 30
SECRET_KEY_FOR_JWT_SIGNING = os.getenv(
    "SECRET_KEY", "dev-secret-key-change-in-production"
)
