"""Управление контентом: предметы, колоды, пакет карточек (239 Protocol)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_authorized_user_object
from app.database import get_database_session_generator
from app.models.user_account import UserAccountModel
from app.schemas.content import (
    DeckBatchSaveRequest,
    DeckShareByEmailRequest,
    LearningSubjectResponseSchema,
    SubjectMetadataTransferObject,
    TopicCardsBatchAddRequest,
    TopicUpdateRequest,
)
from app.services.content_deck_service import (
    add_cards_to_topic_transaction,
    clone_topic_deck_share_to_recipient_by_email,
    create_learning_subject_and_persist,
    fetch_subjects_owned_by_user,
    fetch_topics_for_user_optional_subject,
    delete_topic_for_owner,
    persist_deck_batch_transaction,
    update_topic_metadata_for_owner,
)

learning_content_router = APIRouter(
    prefix="/content",
    tags=["Контент (Subjects / Topics / Cards)"],
)


def _subject_to_schema(row) -> LearningSubjectResponseSchema:
    """Преобразование модели предмета в схему ответа."""
    return LearningSubjectResponseSchema(
        subject_unique_identifier=row.subject_unique_identifier,
        subject_display_name=row.subject_display_name,
        subject_description_text=row.subject_description_text,
        created_by_user_id=row.created_by_user_id,
    )


@learning_content_router.get(
    "/subjects", response_model=list[LearningSubjectResponseSchema]
)
def list_learning_subjects_endpoint(
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """Возвращает список предметов текущего пользователя."""
    rows = fetch_subjects_owned_by_user(
        database_connection_session,
        authorized_user.user_unique_identifier,
    )
    return [_subject_to_schema(r) for r in rows]


@learning_content_router.post(
    "/subjects",
    status_code=201,
    response_model=LearningSubjectResponseSchema,
)
def create_learning_subject_endpoint(
    subject_metadata_transfer_object: SubjectMetadataTransferObject,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """Создаёт новый предмет для текущего пользователя."""
    row = create_learning_subject_and_persist(
        database_connection_session,
        authorized_user.user_unique_identifier,
        subject_metadata_transfer_object.subject_display_name,
        subject_metadata_transfer_object.subject_description_text,
    )
    return _subject_to_schema(row)


@learning_content_router.post("/decks/batch", status_code=201)
def save_deck_batch_endpoint(
    body: DeckBatchSaveRequest,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """Сохраняет колоду и карточки одной транзакцией."""
    topic_row, card_ids = persist_deck_batch_transaction(
        database_connection_session,
        authorized_user.user_unique_identifier,
        body.parent_subject_reference_id,
        body.topic_title_name,
        body.topic_description_text,
        body.new_card_payload_collection,
    )
    return {
        "message": "Колода сохранена",
        "topic_unique_identifier": topic_row.topic_unique_identifier,
        "cards_created_count": len(card_ids),
        "card_unique_identifiers": card_ids,
    }


@learning_content_router.get("/topics")
def list_topics_for_dashboard_endpoint(
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
    parent_subject_reference_id: int | None = Query(default=None),
):
    """Возвращает список тем пользователя (опционально по предмету)."""
    rows = fetch_topics_for_user_optional_subject(
        database_connection_session,
        authorized_user.user_unique_identifier,
        parent_subject_reference_id,
    )
    return [
        {
            "topic_unique_identifier": r.topic_unique_identifier,
            "topic_display_name": r.topic_display_name,
            "topic_description_text": r.topic_description_text,
            "parent_subject_reference_id": r.parent_subject_reference_id,
            "related_topics_count": r.related_topics_count,
        }
        for r in rows
    ]


@learning_content_router.put("/topics/{topic_id}")
def update_topic_endpoint(
    topic_id: int,
    body: TopicUpdateRequest,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """Обновляет метаданные колоды (только владелец)."""
    row = update_topic_metadata_for_owner(
        database_session_instance=database_connection_session,
        authorized_user_account_identifier=authorized_user.user_unique_identifier,
        topic_unique_identifier=int(topic_id),
        topic_display_name=body.topic_display_name,
        topic_description_text=body.topic_description_text,
        parent_subject_reference_id=body.parent_subject_reference_id,
    )
    return {
        "topic_unique_identifier": row.topic_unique_identifier,
        "topic_display_name": row.topic_display_name,
        "topic_description_text": row.topic_description_text,
        "parent_subject_reference_id": row.parent_subject_reference_id,
        "related_topics_count": row.related_topics_count,
    }


@learning_content_router.delete("/topics/{topic_id}", status_code=204)
def delete_topic_endpoint(
    topic_id: int,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """Удаляет колоду и её карточки (только владелец)."""
    delete_topic_for_owner(
        database_session_instance=database_connection_session,
        authorized_user_account_identifier=authorized_user.user_unique_identifier,
        topic_unique_identifier=int(topic_id),
    )
    return None


@learning_content_router.post("/topics/{topic_id}/cards/batch", status_code=201)
def add_cards_to_topic_endpoint(
    topic_id: int,
    body: TopicCardsBatchAddRequest,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """Добавляет карточки в существующую колоду одной транзакцией."""
    ids = add_cards_to_topic_transaction(
        database_session_instance=database_connection_session,
        authorized_user_account_identifier=authorized_user.user_unique_identifier,
        topic_unique_identifier=int(topic_id),
        new_card_payload_collection=body.new_card_payload_collection,
    )
    return {"cards_created_count": len(ids), "card_unique_identifiers": ids}


@learning_content_router.post("/topics/{topic_id}/share", status_code=201)
def share_topic_deck_clone_by_email_endpoint(
    topic_id: int,
    body: DeckShareByEmailRequest,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """Клонирует колоду (тему + карточки) для пользователя с указанным email."""
    new_topic = clone_topic_deck_share_to_recipient_by_email(
        database_connection_session,
        sharer_user_account_identifier=authorized_user.user_unique_identifier,
        source_topic_unique_identifier=int(topic_id),
        recipient_email_normalized=body.email,
    )
    return {
        "message": "Колода отправлена",
        "topic_unique_identifier": new_topic.topic_unique_identifier,
        "cards_copied_count": int(new_topic.related_topics_count or 0),
    }
