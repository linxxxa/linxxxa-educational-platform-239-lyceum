"""
Эндпоинты для персональных обучающих карточек.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_currently_authenticated_user_data
from app.database import get_database_session_generator
from app.models.user_account import UserAccountModel
from app.schemas.card import LearningCardCreate
from app.services.learning_card_service import create_personal_learning_card_and_persist


learning_cards_router = APIRouter(
    prefix="/cards", tags=["Карточки обучения"]
)


@learning_cards_router.post("", status_code=201)
def create_new_personal_learning_card(
    card_creation_request: LearningCardCreate,
    database_connection_session: Session = Depends(get_database_session_generator),
    current_user: UserAccountModel = Depends(get_currently_authenticated_user_data),
):
    """
    Создание карточки. Владелец берётся из JWT (current_user).
    parent_topic_reference_id обязателен в теле запроса.
    """
    newly_created_card = create_personal_learning_card_and_persist(
        database_connection_session,
        owner_user_account_id=current_user.user_unique_identifier,
        parent_topic_reference_id=card_creation_request.parent_topic_reference_id,
        card_question_text_payload=card_creation_request.card_question_text_payload,
        card_answer_text_payload=card_creation_request.card_answer_text_payload,
    )
    return {
        "message": "Карточка создана",
        "card_unique_identifier": newly_created_card.card_unique_identifier,
        "owner_user_account_id": newly_created_card.owner_user_account_id,
        "parent_topic_reference_id": newly_created_card.parent_topic_reference_id,
    }
