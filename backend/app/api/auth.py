"""
Эндпоинты аутентификации: регистрация, вход, JWT.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token_for_user_account,
    verify_plain_password_against_bcrypt_hash,
)
from app.database import get_database_session_generator
from app.schemas.user import UserAccountCreate, UserAccountPublicInformation
from app.services.auth_service import (
    perform_full_user_registration_flow,
    fetch_paginated_user_accounts_from_database,
    fetch_user_account_by_email_address,
    convert_user_models_to_public_schemas,
)
from app.services.content_deck_service import accept_deck_share_token_for_user


auth_router = APIRouter(prefix="/auth", tags=["Аутентификация"])


@auth_router.post("/login")
def authenticate_user_and_generate_token(
    oauth2_password_request_form: OAuth2PasswordRequestForm = Depends(),
    database_connection_session: Session = Depends(
        get_database_session_generator
    ),
):
    """
    Вход: email в поле username, пароль — в password.
    Возвращает access_token (JWT) и token_type.
    """
    email_normalized = oauth2_password_request_form.username.strip().lower()
    user_row = fetch_user_account_by_email_address(
        database_connection_session, email_normalized
    )
    if user_row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )
    if not verify_plain_password_against_bcrypt_hash(
        oauth2_password_request_form.password,
        user_row.user_hashed_password_string,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный пароль",
        )
    encrypted_access_token_string = create_access_token_for_user_account(
        user_row.user_email_address
    )
    return {
        "access_token": encrypted_access_token_string,
        "token_type": "bearer",
    }


@auth_router.post("/register", status_code=201)
@limiter.limit("5/hour")
def register_new_user_endpoint(
    request: Request,
    user_registration_request_data: UserAccountCreate,
    database_session_instance: Session = Depends(
        get_database_session_generator
    ),
):
    """
    Регистрация нового пользователя.
    Делегирует логику сервису, возвращает данные созданного аккаунта.
    """
    _ = request  # slowapi / rate limit
    # Вызов полного цикла регистрации (проверка email, хэш, сохранение)
    newly_created_user_object = perform_full_user_registration_flow(
        database_session_instance,
        user_registration_request_data.user_full_display_name,
        user_registration_request_data.user_email_address,
        user_registration_request_data.plain_text_password_for_hashing,
    )
    cloned_topic_id = None
    deck_share_error = None
    raw_tok = user_registration_request_data.deck_share_token
    if raw_tok and str(raw_tok).strip():
        try:
            cloned_topic = accept_deck_share_token_for_user(
                database_session_instance,
                share_token=str(raw_tok).strip(),
                recipient_user_account_identifier=int(
                    newly_created_user_object.user_unique_identifier
                ),
            )
            cloned_topic_id = int(cloned_topic.topic_unique_identifier)
        except HTTPException as exc:
            deck_share_error = str(exc.detail)

    return {
        "message": "Пользователь успешно зарегистрирован",
        "user_unique_identifier": newly_created_user_object.user_unique_identifier,
        "user_full_display_name": (
            newly_created_user_object.user_full_display_name
        ),
        "user_email_address": newly_created_user_object.user_email_address,
        "cloned_topic_unique_identifier": cloned_topic_id,
        "deck_share_error": deck_share_error,
    }


@auth_router.get("/users", response_model=list[UserAccountPublicInformation])
def get_all_registered_users_from_database(
    database_session_instance: Session = Depends(
        get_database_session_generator
    ),
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
    return convert_user_models_to_public_schemas(
        list_of_registered_user_accounts
    )
