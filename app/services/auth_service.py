"""
Сервис аутентификации: хэширование паролей и проверка уникальности email.
"""
from app.core.security import (
    hash_plain_text_password_with_bcrypt,
    verify_plain_password_against_bcrypt_hash,
)


def check_email_already_registered_in_database(
    database_session_instance,
    email_address_to_check: str
) -> bool:
    """
    Проверяет, зарегистрирован ли уже пользователь с данным email.
    Возвращает True, если email занят; False — если свободен.
    """
    from sqlalchemy import select
    from app.models.user_account import UserAccountModel

    query_result = database_session_instance.execute(
        select(UserAccountModel).where(
            UserAccountModel.user_email_address == email_address_to_check
        )
    )
    existing_user_record = query_result.scalars().first()
    return existing_user_record is not None


def perform_full_user_registration_flow(
    database_session_instance,
    user_full_display_name: str,
    user_email_address: str,
    plain_text_password: str,
):
    """
    Выполняет полный цикл регистрации: проверка email, хэширование, создание, сохранение.
    Возвращает созданный объект UserAccountModel. Вызывает исключение при занятом email.
    """
    from fastapi import HTTPException

    if check_email_already_registered_in_database(
        database_session_instance, user_email_address
    ):
        raise HTTPException(
            status_code=400,
            detail="Пользователь с данным email уже зарегистрирован"
        )
    hashed_password = hash_plain_text_password_with_bcrypt(plain_text_password)
    return create_user_account_and_persist_to_database(
        database_session_instance,
        user_full_display_name,
        user_email_address,
        hashed_password,
    )


def create_user_account_and_persist_to_database(
    database_session_instance,
    user_full_display_name: str,
    user_email_address: str,
    hashed_password_string: str,
):
    """
    Создаёт объект UserAccountModel с начальными метриками и сохраняет в БД.
    Возвращает созданный объект пользователя.
    """
    from app.models.user_account import UserAccountModel

    newly_created_user_object = UserAccountModel(
        user_full_display_name=user_full_display_name,
        user_email_address=user_email_address,
        user_hashed_password_string=hashed_password_string,
        current_cognitive_energy_level=100.0,
        global_mastery_coefficient=0.0,
    )
    database_session_instance.add(newly_created_user_object)
    database_session_instance.commit()
    database_session_instance.refresh(newly_created_user_object)
    return newly_created_user_object


def fetch_paginated_user_accounts_from_database(
    database_session_instance,
    pagination_limit: int = 50,
    pagination_offset: int = 0,
):
    """
    Загружает список пользователей с пагинацией (limit, offset).
    Возвращает объекты UserAccountModel.
    """
    from sqlalchemy import select
    from app.models.user_account import UserAccountModel

    query_result = database_session_instance.execute(
        select(UserAccountModel)
        .limit(pagination_limit)
        .offset(pagination_offset)
    )
    return list(query_result.scalars().all())


def fetch_user_account_by_email_address(
    database_session_instance, email_address: str
):
    """Возвращает UserAccountModel по email или None."""
    from sqlalchemy import select
    from app.models.user_account import UserAccountModel

    result = database_session_instance.execute(
        select(UserAccountModel).where(
            UserAccountModel.user_email_address == email_address
        )
    )
    return result.scalars().first()


def verify_credentials_and_return_user(
    database_session_instance, email_address: str, plain_text_password: str
):
    """
    Проверяет email и пароль. Возвращает UserAccountModel или None.
    """
    user_account = fetch_user_account_by_email_address(
        database_session_instance, email_address
    )
    if user_account is None:
        return None
    if not verify_plain_password_against_bcrypt_hash(
        plain_text_password, user_account.user_hashed_password_string
    ):
        return None
    return user_account


def convert_user_models_to_public_schemas(list_of_user_model_objects):
    """
    Преобразует список UserAccountModel в UserAccountPublicInformation.
    Пароли исключены — в ответ попадают только безопасные поля.
    """
    from app.schemas.user import UserAccountPublicInformation

    return [
        UserAccountPublicInformation(
            user_unique_identifier=obj.user_unique_identifier,
            user_full_display_name=obj.user_full_display_name,
            user_email_address=obj.user_email_address,
            current_cognitive_energy_level=obj.current_cognitive_energy_level,
        )
        for obj in list_of_user_model_objects
    ]
