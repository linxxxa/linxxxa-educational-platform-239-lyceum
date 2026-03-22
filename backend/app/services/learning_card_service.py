"""
Сервис обучающих карточек: создание, проверки.
"""
from fastapi import HTTPException
from sqlalchemy import select

from app.models.learning_card import LearningCardModel
from app.models.learning_topic import LearningTopicModel


def check_parent_topic_exists(database_session_instance, topic_identifier: int) -> bool:
    """Проверяет существование темы по ID."""
    result = database_session_instance.execute(
        select(LearningTopicModel).where(
            LearningTopicModel.topic_unique_identifier == topic_identifier
        )
    )
    return result.scalars().first() is not None


def create_personal_learning_card_and_persist(
    database_session_instance,
    owner_user_account_id: int,
    parent_topic_reference_id: int,
    card_question_text_payload: str,
    card_answer_text_payload: str,
) -> LearningCardModel:
    """Создаёт карточку и сохраняет в БД."""
    if not check_parent_topic_exists(database_session_instance, parent_topic_reference_id):
        raise HTTPException(
            status_code=404, detail="Тема с указанным ID не найдена"
        )
    newly_created_card_object = LearningCardModel(
        owner_user_account_id=owner_user_account_id,
        parent_topic_reference_id=parent_topic_reference_id,
        card_question_text_payload=card_question_text_payload,
        card_answer_text_payload=card_answer_text_payload,
    )
    database_session_instance.add(newly_created_card_object)
    database_session_instance.commit()
    database_session_instance.refresh(newly_created_card_object)
    return newly_created_card_object
