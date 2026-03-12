"""
Точка входа приложения. Запуск: uvicorn main:fastapi_application --reload
"""
import os
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.auth import auth_router
from app.api.learning_topics import learning_topics_router

DEBUG_MODE = os.getenv("DEBUG", "0") == "1"
from app.database import (
    Base_Model_Declarative_Root,
    platform_database_engine,
)
from app.models.user_account import UserAccountModel
from app.models.learning_topic import LearningTopicModel
from app.models.learning_card import LearningCardModel  # Регистрация моделей для create_all

fastapi_application = FastAPI(title="ФМЛ 239 — Адаптивное обучение")


@fastapi_application.exception_handler(Exception)
def log_unhandled_exceptions_handler(
    request: Request, unhandled_exception: Exception
):
    """Логирует traceback; в DEBUG возвращает детали ошибки для отладки."""
    traceback.print_exc()
    content = {"detail": "Internal Server Error"}
    if DEBUG_MODE:
        content["debug_error"] = str(unhandled_exception)
    return JSONResponse(status_code=500, content=content)


fastapi_application.include_router(auth_router)
fastapi_application.include_router(learning_topics_router)
fastapi_application.include_router(learning_cards_router)

# Создание таблиц при старте приложения
Base_Model_Declarative_Root.metadata.create_all(bind=platform_database_engine)
