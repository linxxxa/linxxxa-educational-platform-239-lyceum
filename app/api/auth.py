"""
Эндпоинты аутентификации: регистрация и вход пользователей.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_database_session_generator
from app.schemas.user import UserAccountCreate, UserAccountPublicInformation
from app.services.auth_service import (
    perform_full_user_registration_flow,
    fetch_paginated_user_accounts_from_database,
    convert_user_models_to_public_schemas,
)


auth_router = APIRouter(prefix="/auth", tags=["Аутентификация"])


@auth_router.post("/register", status_code=201)
def register_new_user_endpoint(
    user_registration_request_data: UserAccountCreate,
    database_session_instance: Session = Depends(get_database_session_generator),
):
    """
    Регистрация нового пользователя.
    Делегирует логику сервису, возвращает данные созданного аккаунта.
    """
    # Вызов полного цикла регистрации (проверка email, хэш, сохранение)
    newly_created_user_object = perform_full_user_registration_flow(
        database_session_instance,
        user_registration_request_data.user_full_display_name,
        user_registration_request_data.user_email_address,
        user_registration_request_data.plain_text_password_for_hashing,
    )
    return {
        "message": "Пользователь успешно зарегистрирован",
        "user_unique_identifier": newly_created_user_object.user_unique_identifier,
        "user_full_display_name": newly_created_user_object.user_full_display_name,
        "user_email_address": newly_created_user_object.user_email_address,
    }


@auth_router.get("/users", response_model=list[UserAccountPublicInformation])
def get_all_registered_users_from_database(
    database_session_instance: Session = Depends(get_database_session_generator),
    pagination_limit: int = Query(default=50, ge=1, le=100),
    pagination_offset: int = Query(default=0, ge=0),
):
    """
    Список аккаунтов. UserAccountPublicInformation исключает пароли — хеши
    не возвращаются в API.
    """
    list_of_registered_user_accounts = (
        fetch_paginated_user_accounts_from_database(
            database_session_instance,
            pagination_limit=pagination_limit,
            pagination_offset=pagination_offset,
        )
    )
    return convert_user_models_to_public_schemas(list_of_registered_user_accounts)
