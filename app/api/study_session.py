"""
Эндпоинты сессий обучения: ответы на карточки, SM-2.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_authorized_user_object
from app.database import get_database_session_generator
from app.models.user_account import UserAccountModel
from app.models.learning_card import LearningCardModel
from app.schemas.study import UserAnswerSubmission
from app.services.learning_process_service import process_user_answer_impact


study_session_router = APIRouter(prefix="/study", tags=["Сессия обучения"])


def _fetch_card_and_validate_ownership(
    database_session_instance: Session,
    card_identifier: int,
    user_identifier: int,
) -> LearningCardModel | None:
    """
    Загружает карточку. Проверка владения — защита от изменения чужих данных.
    """
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload

    result = database_session_instance.execute(
        select(LearningCardModel)
        .options(joinedload(LearningCardModel.parent_topic))
        .where(LearningCardModel.card_unique_identifier == card_identifier)
    )
    card = result.scalars().first()
    if card is None or card.owner_user_account_id != user_identifier:
        return None
    return card


@study_session_router.post("/submit-answer")
def submit_user_answer_endpoint(
    submitted_answer_data_transfer_object: UserAnswerSubmission,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_student_user_account: UserAccountModel = Depends(
        get_current_authorized_user_object
    ),
):
    """
    POST /study/submit-answer. Проверка владения — защита от
    несанкционированного изменения чужих карточек.
    """
    updated_learning_card_instance = _fetch_card_and_validate_ownership(
        database_connection_session,
        submitted_answer_data_transfer_object.target_card_unique_identifier,
        authorized_student_user_account.user_unique_identifier,
    )
    if updated_learning_card_instance is None:
        raise HTTPException(status_code=404, detail="Карточка не найдена")
    process_user_answer_impact(
        database_connection_session,
        authorized_student_user_account,
        updated_learning_card_instance,
        confidence_score_q=submitted_answer_data_transfer_object.user_subjective_confidence_score,
        thinking_time_tau=submitted_answer_data_transfer_object.response_thinking_time_seconds,
    )
    return {
        "card_next_review_datetime": updated_learning_card_instance.card_next_review_datetime,
        "remaining_cognitive_energy_level": (
            authorized_student_user_account.current_cognitive_energy_level
        ),
    }
