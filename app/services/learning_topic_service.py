"""
Сервис тем обучения: проверки, создание, выборка.
Логика вынесена для соблюдения лимита 25 строк в эндпоинтах.
"""
from fastapi import HTTPException
from sqlalchemy import select

from app.models.learning_topic import LearningTopicModel


def check_topic_with_name_already_exists(
    database_session_instance,
    topic_display_name: str,
) -> bool:
    """Проверяет, есть ли уже тема с таким названием."""
    query = select(LearningTopicModel).where(
        LearningTopicModel.topic_display_name == topic_display_name
    )
    return database_session_instance.execute(query).scalars().first() is not None


def check_parent_topic_exists_in_database(
    database_session_instance,
    parent_topic_identifier: int,
) -> bool:
    """
    Проверка существования родительской темы — целостность графа знаний.
    Ссылка на несуществующий parent нарушает иерархию.
    """
    query = select(LearningTopicModel).where(
        LearningTopicModel.topic_unique_identifier == parent_topic_identifier
    )
    return database_session_instance.execute(query).scalars().first() is not None


def _validate_topic_creation_constraints(
    database_session_instance,
    topic_display_name: str,
    parent_topic_reference_identifier: int | None,
) -> None:
    """Проверка уникальности названия и существования родителя. Raises HTTPException."""
    existing_topic_with_same_name = check_topic_with_name_already_exists(
        database_session_instance, topic_display_name
    )
    if existing_topic_with_same_name:
        raise HTTPException(status_code=400, detail="Тема с таким названием уже существует")
    if parent_topic_reference_identifier is not None:
        if not check_parent_topic_exists_in_database(
            database_session_instance, parent_topic_reference_identifier
        ):
            raise HTTPException(
                status_code=404, detail="Родительская тема с указанным ID не найдена"
            )


def check_user_exists_in_database(
    database_session_instance, user_identifier: int
) -> bool:
    """Проверяет, существует ли пользователь с указанным ID."""
    from app.models.user_account import UserAccountModel

    query = select(UserAccountModel).where(
        UserAccountModel.user_unique_identifier == user_identifier
    )
    return database_session_instance.execute(query).scalars().first() is not None


def create_learning_topic_and_persist(
    database_session_instance,
    topic_display_name: str,
    topic_description_text: str | None,
    parent_topic_reference_identifier: int | None,
    topic_owner_user_id: int | None = None,
) -> LearningTopicModel:
    """Создаёт и сохраняет тему. Вызывает HTTPException при ошибках валидации."""
    _validate_topic_creation_constraints(
        database_session_instance, topic_display_name, parent_topic_reference_identifier
    )
    if topic_owner_user_id is not None:
        if not check_user_exists_in_database(database_session_instance, topic_owner_user_id):
            raise HTTPException(status_code=404, detail="Пользователь-автор не найден")
    newly_initialized_topic_object = LearningTopicModel(
        topic_display_name=topic_display_name,
        topic_description_text=topic_description_text,
        parent_topic_reference_identifier=parent_topic_reference_identifier,
        topic_owner_user_id=topic_owner_user_id,
    )
    database_session_instance.add(newly_initialized_topic_object)
    database_session_instance.commit()
    database_session_instance.refresh(newly_initialized_topic_object)
    return newly_initialized_topic_object


def fetch_paginated_learning_topics(
    database_session_instance,
    pagination_limit: int = 50,
    pagination_offset: int = 0,
) -> list[LearningTopicModel]:
    """Возвращает список тем с пагинацией."""
    query = (
        select(LearningTopicModel)
        .limit(pagination_limit)
        .offset(pagination_offset)
    )
    return list(database_session_instance.execute(query).scalars().all())
