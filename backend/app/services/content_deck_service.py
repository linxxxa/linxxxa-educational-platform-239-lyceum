"""
Транзакционное сохранение колоды: тема + карточки (239 Protocol).
"""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.learning_card import LearningCardModel, LearningCardTypeEnum
from app.models.learning_subject import LearningSubjectModel
from app.models.learning_topic import LearningTopicModel
from app.schemas.content import CardPayloadItem


_CARD_TYPE_FROM_PROTOCOL = {
    "CONCEPT": LearningCardTypeEnum.concept,
    "FORMULA": LearningCardTypeEnum.formula,
    "TASK": LearningCardTypeEnum.task,
}


def validate_latex_delimiters_basic(card_content_question_latex: str, card_content_answer_latex: str) -> None:
    """Мягкая проверка: чётное число $$ для блочного LaTeX (не ошибка для чистого текста)."""
    for label, tex in (
        ("вопроса", card_content_question_latex),
        ("ответа", card_content_answer_latex),
    ):
        if tex.count("$$") % 2 != 0:
            raise HTTPException(
                status_code=422,
                detail=f"Незакрытый блок $$ в тексте {label}",
            )


def _topic_exists_same_subject_owner(
    database_session_instance: Session,
    topic_display_name: str,
    parent_subject_reference_id: int,
    topic_owner_user_id: int,
) -> bool:
    q = select(LearningTopicModel).where(
        LearningTopicModel.topic_display_name == topic_display_name,
        LearningTopicModel.parent_subject_reference_id == parent_subject_reference_id,
        LearningTopicModel.topic_owner_user_id == topic_owner_user_id,
    )
    return database_session_instance.execute(q).scalars().first() is not None


def persist_deck_batch_transaction(
    database_session_instance: Session,
    authorized_user_account_identifier: int,
    parent_subject_reference_id: int,
    topic_title_name: str,
    topic_description_text: str | None,
    is_public_visibility: bool,
    new_card_payload_collection: list[CardPayloadItem],
) -> tuple[LearningTopicModel, list[int]]:
    """
    Одна транзакция: тема + все карточки. При ошибке — rollback через raise.
    """
    subj = database_session_instance.get(
        LearningSubjectModel, parent_subject_reference_id
    )
    if subj is None:
        raise HTTPException(status_code=404, detail="Предмет не найден")
    if subj.created_by_user_id != authorized_user_account_identifier:
        raise HTTPException(status_code=403, detail="Нет доступа к этому предмету")

    name_clean = topic_title_name.strip()
    if _topic_exists_same_subject_owner(
        database_session_instance,
        name_clean,
        parent_subject_reference_id,
        authorized_user_account_identifier,
    ):
        raise HTTPException(
            status_code=400,
            detail="Колода с таким названием в этом предмете уже существует",
        )

    concepts_n = len(new_card_payload_collection)

    topic_row = LearningTopicModel(
        topic_display_name=name_clean,
        topic_description_text=topic_description_text,
        parent_topic_reference_identifier=None,
        parent_subject_reference_id=parent_subject_reference_id,
        topic_owner_user_id=authorized_user_account_identifier,
        related_topics_count=concepts_n,
        is_public_visibility=is_public_visibility,
    )
    database_session_instance.add(topic_row)
    database_session_instance.flush()

    for item in new_card_payload_collection:
        validate_latex_delimiters_basic(
            item.card_content_question_latex,
            item.card_content_answer_latex,
        )
        cat = _CARD_TYPE_FROM_PROTOCOL.get(
            str(item.card_type_category).upper(),
            LearningCardTypeEnum.concept,
        )
        database_session_instance.add(
            LearningCardModel(
                owner_user_account_id=authorized_user_account_identifier,
                parent_topic_reference_id=topic_row.topic_unique_identifier,
                card_question_text_payload=item.card_content_question_latex.strip(),
                card_answer_text_payload=item.card_content_answer_latex.strip(),
                card_type=cat,
            )
        )
    database_session_instance.flush()
    id_rows = database_session_instance.execute(
        select(LearningCardModel.card_unique_identifier).where(
            LearningCardModel.parent_topic_reference_id
            == topic_row.topic_unique_identifier,
            LearningCardModel.owner_user_account_id
            == authorized_user_account_identifier,
        )
    ).scalars().all()
    card_ids = [int(i) for i in id_rows]

    database_session_instance.commit()
    database_session_instance.refresh(topic_row)
    return topic_row, card_ids


def create_learning_subject_and_persist(
    database_session_instance: Session,
    authorized_user_account_identifier: int,
    subject_display_name: str,
    subject_description_text: str | None,
) -> LearningSubjectModel:
    row = LearningSubjectModel(
        subject_display_name=subject_display_name.strip(),
        subject_description_text=subject_description_text,
        created_by_user_id=authorized_user_account_identifier,
    )
    database_session_instance.add(row)
    database_session_instance.commit()
    database_session_instance.refresh(row)
    return row


def fetch_subjects_owned_by_user(
    database_session_instance: Session,
    user_id: int,
) -> list[LearningSubjectModel]:
    q = (
        select(LearningSubjectModel)
        .where(LearningSubjectModel.created_by_user_id == user_id)
        .order_by(LearningSubjectModel.subject_display_name.asc())
    )
    return list(database_session_instance.execute(q).scalars().all())


def fetch_topics_for_user_optional_subject(
    database_session_instance: Session,
    user_id: int,
    parent_subject_reference_id: int | None,
) -> list[LearningTopicModel]:
    q = select(LearningTopicModel).where(
        LearningTopicModel.topic_owner_user_id == user_id,
    )
    if parent_subject_reference_id is not None:
        q = q.where(
            LearningTopicModel.parent_subject_reference_id
            == parent_subject_reference_id
        )
    q = q.order_by(LearningTopicModel.topic_display_name.asc())
    return list(database_session_instance.execute(q).scalars().all())


def update_topic_metadata_for_owner(
    database_session_instance: Session,
    *,
    authorized_user_account_identifier: int,
    topic_unique_identifier: int,
    topic_display_name: str | None,
    topic_description_text: str | None,
    parent_subject_reference_id: int | None,
    is_public_visibility: bool | None,
) -> LearningTopicModel:
    topic = database_session_instance.get(LearningTopicModel, int(topic_unique_identifier))
    if topic is None:
        raise HTTPException(status_code=404, detail="Колода не найдена")
    if int(topic.topic_owner_user_id or 0) != int(authorized_user_account_identifier):
        raise HTTPException(status_code=403, detail="Нет доступа к этой колоде")

    if topic_display_name is not None:
        topic.topic_display_name = topic_display_name.strip()
    if topic_description_text is not None:
        topic.topic_description_text = topic_description_text
    if parent_subject_reference_id is not None:
        subj = database_session_instance.get(LearningSubjectModel, int(parent_subject_reference_id))
        if subj is None:
            raise HTTPException(status_code=404, detail="Предмет не найден")
        if int(subj.created_by_user_id) != int(authorized_user_account_identifier):
            raise HTTPException(status_code=403, detail="Нет доступа к этому предмету")
        topic.parent_subject_reference_id = int(parent_subject_reference_id)
    if is_public_visibility is not None:
        topic.is_public_visibility = bool(is_public_visibility)

    database_session_instance.add(topic)
    database_session_instance.commit()
    database_session_instance.refresh(topic)
    return topic


def delete_topic_for_owner(
    database_session_instance: Session,
    *,
    authorized_user_account_identifier: int,
    topic_unique_identifier: int,
) -> None:
    topic = database_session_instance.get(LearningTopicModel, int(topic_unique_identifier))
    if topic is None:
        raise HTTPException(status_code=404, detail="Колода не найдена")
    if int(topic.topic_owner_user_id or 0) != int(authorized_user_account_identifier):
        raise HTTPException(status_code=403, detail="Нет доступа к этой колоде")

    # SQLite не всегда гарантирует ON DELETE CASCADE, удаляем карточки явно.
    database_session_instance.query(LearningCardModel).filter(
        LearningCardModel.parent_topic_reference_id == int(topic_unique_identifier),
        LearningCardModel.owner_user_account_id == int(authorized_user_account_identifier),
    ).delete(synchronize_session=False)

    database_session_instance.delete(topic)
    database_session_instance.commit()


def add_cards_to_topic_transaction(
    database_session_instance: Session,
    *,
    authorized_user_account_identifier: int,
    topic_unique_identifier: int,
    new_card_payload_collection: list[CardPayloadItem],
) -> list[int]:
    """Добавляет карточки в существующую колоду одной транзакцией."""
    topic = database_session_instance.get(LearningTopicModel, int(topic_unique_identifier))
    if topic is None:
        raise HTTPException(status_code=404, detail="Колода не найдена")
    if int(topic.topic_owner_user_id or 0) != int(authorized_user_account_identifier):
        raise HTTPException(status_code=403, detail="Нет доступа к этой колоде")

    for item in new_card_payload_collection:
        validate_latex_delimiters_basic(
            item.card_content_question_latex,
            item.card_content_answer_latex,
        )
        cat = _CARD_TYPE_FROM_PROTOCOL.get(
            str(item.card_type_category).upper(),
            LearningCardTypeEnum.concept,
        )
        database_session_instance.add(
            LearningCardModel(
                owner_user_account_id=authorized_user_account_identifier,
                parent_topic_reference_id=int(topic_unique_identifier),
                card_question_text_payload=item.card_content_question_latex.strip(),
                card_answer_text_payload=item.card_content_answer_latex.strip(),
                card_type=cat,
            )
        )

    database_session_instance.flush()
    id_rows = database_session_instance.execute(
        select(LearningCardModel.card_unique_identifier).where(
            LearningCardModel.parent_topic_reference_id == int(topic_unique_identifier),
            LearningCardModel.owner_user_account_id == authorized_user_account_identifier,
        )
    ).scalars().all()
    card_ids = [int(i) for i in id_rows]

    # related_topics_count используется как C в энтропии; держим его
    # равным количеству карточек в теме для консистентности.
    topic.related_topics_count = int(len(card_ids))
    database_session_instance.add(topic)
    database_session_instance.commit()
    return card_ids
