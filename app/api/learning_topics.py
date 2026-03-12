"""
Эндпоинты для управления темами обучения (Граф Знаний).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_database_session_generator
from app.dependencies import get_current_authorized_user_id_from_header
from app.schemas.topic import LearningTopicCreate, LearningTopicSchema
from app.services.learning_topic_service import (
    create_learning_topic_and_persist,
    fetch_paginated_learning_topics,
)


learning_topics_router = APIRouter(prefix="/topics", tags=["Темы обучения"])


@learning_topics_router.post("", status_code=201, response_model=LearningTopicSchema)
def create_new_learning_topic_definition(
    topic_creation_request: LearningTopicCreate,
    database_connection_session: Session = Depends(get_database_session_generator),
):
    """
    Создание темы. Проверяется уникальность названия и существование
    родительской темы — целостность графа знаний.
    """
    newly_initialized_topic_object = create_learning_topic_and_persist(
        database_connection_session,
        topic_creation_request.topic_display_name,
        topic_creation_request.topic_description_text,
        topic_creation_request.parent_topic_reference_identifier,
    )
    return _topic_model_to_schema(newly_initialized_topic_object)


def _topic_model_to_schema(topic_model_object) -> LearningTopicSchema:
    """Преобразование модели в схему ответа."""
    return LearningTopicSchema(
        topic_unique_identifier=topic_model_object.topic_unique_identifier,
        topic_display_name=topic_model_object.topic_display_name,
        topic_description_text=topic_model_object.topic_description_text,
        topic_entropy_complexity_value=topic_model_object.topic_entropy_complexity_value,
        parent_topic_reference_identifier=(
            topic_model_object.parent_topic_reference_identifier
        ),
        topic_owner_user_id=topic_model_object.topic_owner_user_id,
    )


@learning_topics_router.get("", response_model=list[LearningTopicSchema])
def get_all_available_learning_topics(
    database_connection_session: Session = Depends(get_database_session_generator),
    pagination_limit: int = Query(default=50, ge=1, le=100),
    pagination_offset: int = Query(default=0, ge=0),
):
    """Список всех тем с пагинацией."""
    list_of_topic_objects = fetch_paginated_learning_topics(
        database_connection_session,
        pagination_limit=pagination_limit,
        pagination_offset=pagination_offset,
    )
    return [_topic_model_to_schema(obj) for obj in list_of_topic_objects]
