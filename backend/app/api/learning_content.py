"""Управление контентом: предметы, колоды, пакет карточек (239 Protocol)."""
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_authorized_user_object
from app.core.rate_limit import limiter
from app.database import get_database_session_generator
from app.models.learning_card import LearningCardModel
from app.models.learning_topic import LearningTopicModel
from app.models.user_account import UserAccountModel
from app.models.user_card_progress import UserCardProgressModel
from app.schemas.content import (
    CardPayloadItem,
    DeckBatchSaveRequest,
    DeckShareByEmailRequest,
    LearningSubjectResponseSchema,
    SubjectMetadataTransferObject,
    TopicCardsBatchAddRequest,
    TopicUpdateRequest,
)
from app.services.content_deck_service import (
    add_cards_to_topic_transaction,
    accept_deck_share_token_for_user,
    card_type_category_string_from_enum,
    create_deck_share_invite_and_send_email,
    create_learning_subject_and_persist,
    delete_learning_card_for_topic_owner,
    fetch_subjects_owned_by_user,
    fetch_topics_for_user_optional_subject,
    delete_topic_for_owner,
    get_deck_share_token_preview,
    persist_deck_batch_transaction,
    update_learning_card_for_topic_owner,
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


@learning_content_router.get("/topics/{topic_id}/cards")
def list_cards_in_topic_endpoint(
    topic_id: int,
    limit: int = Query(default=200, ge=1, le=1000),
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """
    Возвращает карточки колоды для режимов игры (matching/sprint).
    Только владелец колоды.
    """
    topic = database_connection_session.get(LearningTopicModel, int(topic_id))
    if topic is None:
        return {"cards": []}
    if int(topic.topic_owner_user_id or 0) != int(
        authorized_user.user_unique_identifier
    ):
        return {"cards": []}

    uid = int(authorized_user.user_unique_identifier)
    rows = (
        database_connection_session.execute(
            select(
                LearningCardModel.card_unique_identifier,
                LearningCardModel.card_question_text_payload,
                LearningCardModel.card_answer_text_payload,
                func.coalesce(
                    UserCardProgressModel.progress_mastery_level, 0.0
                ),
                LearningCardModel.card_type,
            )
            .outerjoin(
                UserCardProgressModel,
                (
                    UserCardProgressModel.progress_target_card_unique_identifier
                    == LearningCardModel.card_unique_identifier
                )
                & (UserCardProgressModel.progress_owner_user_account_id == uid),
            )
            .where(
                LearningCardModel.parent_topic_reference_id == int(topic_id),
                LearningCardModel.owner_user_account_id == uid,
            )
            .order_by(LearningCardModel.card_unique_identifier.asc())
            .limit(int(limit))
        )
        .all()
    )
    return {
        "cards": [
            {
                "card_id": int(r[0]),
                "question_text": str(r[1] or ""),
                "answer_text": str(r[2] or ""),
                "mastery_level": float(r[3] or 0.0),
                "card_type_category": card_type_category_string_from_enum(r[4]),
            }
            for r in rows
        ]
    }


@learning_content_router.put("/topics/{topic_id}/cards/{card_id}")
def update_single_card_in_topic_endpoint(
    topic_id: int,
    card_id: int,
    body: CardPayloadItem,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """Обновление одной карточки в колоде (владелец)."""
    row = update_learning_card_for_topic_owner(
        database_connection_session,
        authorized_user_account_identifier=int(
            authorized_user.user_unique_identifier
        ),
        topic_unique_identifier=int(topic_id),
        card_unique_identifier=int(card_id),
        payload=body,
    )
    return {
        "card_id": int(row.card_unique_identifier),
        "question_text": str(row.card_question_text_payload or ""),
        "answer_text": str(row.card_answer_text_payload or ""),
        "mastery_level": None,
        "card_type_category": card_type_category_string_from_enum(row.card_type),
    }


@learning_content_router.delete(
    "/topics/{topic_id}/cards/{card_id}", status_code=204
)
def delete_single_card_in_topic_endpoint(
    topic_id: int,
    card_id: int,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """Удаление одной карточки из колоды (владелец)."""
    delete_learning_card_for_topic_owner(
        database_connection_session,
        authorized_user_account_identifier=int(
            authorized_user.user_unique_identifier
        ),
        topic_unique_identifier=int(topic_id),
        card_unique_identifier=int(card_id),
    )
    return None


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
@limiter.limit("5/hour")
def share_topic_deck_clone_by_email_endpoint(
    request: Request,
    topic_id: int,
    body: DeckShareByEmailRequest,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """Создаёт приглашение; письмо уходит по SMTP, если задан SMTP_HOST (см. .env.example)."""
    _ = request  # slowapi / rate limit
    return create_deck_share_invite_and_send_email(
        database_connection_session,
        sharer_user_account_identifier=authorized_user.user_unique_identifier,
        source_topic_unique_identifier=int(topic_id),
        recipient_email_raw=body.email,
    )


@learning_content_router.get("/share/{token}/preview")
def deck_share_preview_endpoint(
    token: str,
    database_connection_session: Session = Depends(get_database_session_generator),
):
    """Публичное превью приглашения (для экрана /decks/share)."""
    return get_deck_share_token_preview(database_connection_session, token)


@learning_content_router.post("/share/{token}/accept", status_code=201)
def deck_share_accept_endpoint(
    token: str,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_user: UserAccountModel = Depends(get_current_authorized_user_object),
):
    """Принять приглашение: клонировать колоду в аккаунт текущего пользователя."""
    new_topic = accept_deck_share_token_for_user(
        database_connection_session,
        share_token=token,
        recipient_user_account_identifier=authorized_user.user_unique_identifier,
    )
    return {
        "message": "Колода добавлена",
        "cloned_topic_unique_identifier": int(new_topic.topic_unique_identifier),
        "cards_copied_count": int(new_topic.related_topics_count or 0),
    }
