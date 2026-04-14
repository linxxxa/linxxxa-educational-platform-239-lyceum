"""
Транзакционное сохранение колоды: тема + карточки (239 Protocol).
"""
import logging
import os
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.deck_share_token import DeckShareTokenModel
from app.models.learning_card import LearningCardModel, LearningCardTypeEnum
from app.models.learning_subject import LearningSubjectModel
from app.models.learning_topic import LearningTopicModel
from app.models.user_account import UserAccountModel
from app.schemas.content import CardPayloadItem
from app.services.email_delivery import try_send_html_email
from app.services.user_analytics_service import recalculate_topic_knowledge_level_for_owner

logger = logging.getLogger(__name__)


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
    recalculate_topic_knowledge_level_for_owner(
        database_session_instance,
        authorized_user_account_identifier,
        int(topic_unique_identifier),
    )
    database_session_instance.commit()
    return card_ids


USER_NOT_FOUND_SHARE_MESSAGE = (
    "Пользователь не найден. Пригласите его в EduLab!"
)


def _normalize_email_for_share(email: str) -> str:
    return email.strip().lower()


def clone_topic_deck_to_recipient_user(
    database_session_instance: Session,
    *,
    sharer_user_account_identifier: int,
    source_topic_unique_identifier: int,
    recipient_user_account_identifier: int,
) -> LearningTopicModel:
    """
    Полная копия темы и карточек для указанного пользователя-получателя.
    SM-2 и прогресс не копируются.
    """
    topic = database_session_instance.get(
        LearningTopicModel, int(source_topic_unique_identifier)
    )
    if topic is None:
        raise HTTPException(status_code=404, detail="Колода не найдена")
    if int(topic.topic_owner_user_id or 0) != int(sharer_user_account_identifier):
        raise HTTPException(status_code=403, detail="Нет доступа к этой колоде")
    if int(recipient_user_account_identifier) == int(sharer_user_account_identifier):
        raise HTTPException(
            status_code=400,
            detail="Нельзя отправить колоду самому себе",
        )

    source_cards = list(
        database_session_instance.execute(
            select(LearningCardModel).where(
                LearningCardModel.parent_topic_reference_id
                == int(source_topic_unique_identifier),
                LearningCardModel.owner_user_account_id
                == int(sharer_user_account_identifier),
            )
        ).scalars().all()
    )

    new_topic = LearningTopicModel(
        topic_display_name=topic.topic_display_name,
        topic_description_text=topic.topic_description_text,
        topic_entropy_complexity_value=float(
            topic.topic_entropy_complexity_value or 0.0
        ),
        topic_entropy_value=float(topic.topic_entropy_value or 0.0),
        related_topics_count=len(source_cards),
        parent_topic_reference_identifier=None,
        parent_subject_reference_id=None,
        topic_owner_user_id=int(recipient_user_account_identifier),
    )
    database_session_instance.add(new_topic)
    database_session_instance.flush()

    for card in source_cards:
        database_session_instance.add(
            LearningCardModel(
                owner_user_account_id=int(recipient_user_account_identifier),
                parent_topic_reference_id=int(new_topic.topic_unique_identifier),
                card_question_text_payload=card.card_question_text_payload,
                card_answer_text_payload=card.card_answer_text_payload,
                card_type=card.card_type,
            )
        )

    recalculate_topic_knowledge_level_for_owner(
        database_session_instance,
        int(recipient_user_account_identifier),
        int(new_topic.topic_unique_identifier),
    )
    database_session_instance.commit()
    database_session_instance.refresh(new_topic)
    return new_topic


def clone_topic_deck_share_to_recipient_by_email(
    database_session_instance: Session,
    *,
    sharer_user_account_identifier: int,
    source_topic_unique_identifier: int,
    recipient_email_normalized: str,
) -> LearningTopicModel:
    """Устаревший прямой клон по email — для обратной совместимости тестов."""
    recipient_row = database_session_instance.execute(
        select(UserAccountModel).where(
            func.lower(UserAccountModel.user_email_address)
            == recipient_email_normalized
        )
    ).scalars().first()
    if recipient_row is None:
        raise HTTPException(
            status_code=404,
            detail=USER_NOT_FOUND_SHARE_MESSAGE,
        )
    return clone_topic_deck_to_recipient_user(
        database_session_instance,
        sharer_user_account_identifier=sharer_user_account_identifier,
        source_topic_unique_identifier=source_topic_unique_identifier,
        recipient_user_account_identifier=int(recipient_row.user_unique_identifier),
    )


def _frontend_base_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3001").rstrip("/")


def _build_deck_share_email_html(
    *,
    topic_title: str,
    sharer_label: str,
    recipient_email: str,
    universal_link: str,
    registered_deep_link: str,
    new_user_register_link: str,
    recipient_already_registered: bool,
) -> str:
    cta = "Забрать колоду и начать учиться"
    hint = (
        "Вы уже зарегистрированы — после входа колода будет добавлена автоматически."
        if recipient_already_registered
        else "Создайте аккаунт по ссылке — колода будет привязана к профилю."
    )
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:14px;color:#525252;">EduLab</p>
          <h1 style="margin:0 0 12px;font-size:20px;color:#171717;">Вам передали колоду</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#404040;"><strong>{topic_title}</strong></p>
          <p style="margin:0 0 20px;font-size:13px;color:#737373;">От: {sharer_label} · для {recipient_email}</p>
          <p style="margin:0 0 24px;font-size:13px;color:#525252;">{hint}</p>
          <div style="text-align:center;margin:0 0 24px;">
            <a href="{universal_link}" style="display:inline-block;padding:14px 28px;background:#2F3437;color:#fff;
              text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">{cta}</a>
          </div>
          <p style="margin:0 0 8px;font-size:12px;color:#a3a3a3;">Или откройте:</p>
          <p style="margin:0;font-size:11px;word-break:break-all;color:#737373;">
            Зарегистрированным: <a href="{registered_deep_link}">{registered_deep_link}</a><br/>
            Новым пользователям: <a href="{new_user_register_link}">{new_user_register_link}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def create_deck_share_invite_and_send_email(
    database_session_instance: Session,
    *,
    sharer_user_account_identifier: int,
    source_topic_unique_identifier: int,
    recipient_email_raw: str,
) -> dict:
    """
    Создаёт токен приглашения (без мгновенного клонирования).
    Письмо с HTML и ссылками отправляется через SMTP, если задан SMTP_HOST.
    """
    recipient_email_normalized = _normalize_email_for_share(recipient_email_raw)
    topic = database_session_instance.get(
        LearningTopicModel, int(source_topic_unique_identifier)
    )
    if topic is None:
        raise HTTPException(status_code=404, detail="Колода не найдена")
    if int(topic.topic_owner_user_id or 0) != int(sharer_user_account_identifier):
        raise HTTPException(status_code=403, detail="Нет доступа к этой колоде")

    sharer = database_session_instance.get(
        UserAccountModel, int(sharer_user_account_identifier)
    )
    if sharer is None:
        raise HTTPException(status_code=403, detail="Нет доступа")

    recipient_row = database_session_instance.execute(
        select(UserAccountModel).where(
            func.lower(UserAccountModel.user_email_address)
            == recipient_email_normalized
        )
    ).scalars().first()
    if recipient_row is not None and int(
        recipient_row.user_unique_identifier
    ) == int(sharer_user_account_identifier):
        raise HTTPException(
            status_code=400,
            detail="Нельзя отправить колоду самому себе",
        )

    token_str = secrets.token_urlsafe(32)
    now = datetime.utcnow()
    expires = now + timedelta(days=7)
    row = DeckShareTokenModel(
        share_token=token_str,
        source_topic_unique_identifier=int(source_topic_unique_identifier),
        sharer_user_account_id=int(sharer_user_account_identifier),
        recipient_email_normalized=recipient_email_normalized,
        created_at=now,
        expires_at=expires,
    )
    database_session_instance.add(row)
    database_session_instance.commit()

    base = _frontend_base_url()
    universal = f"{base}/decks/share/{token_str}"
    registered_deep = f"{base}/dashboard?shareToken={token_str}"
    new_user_link = (
        f"{base}/register?inviteCode={token_str}"
        f"&targetDeck={int(source_topic_unique_identifier)}"
    )
    recipient_registered = recipient_row is not None

    sharer_label = getattr(sharer, "user_full_display_name", None) or getattr(
        sharer, "user_email_address", "Пользователь"
    )
    html = _build_deck_share_email_html(
        topic_title=topic.topic_display_name or "Колода",
        sharer_label=str(sharer_label),
        recipient_email=recipient_email_normalized,
        universal_link=universal,
        registered_deep_link=registered_deep,
        new_user_register_link=new_user_link,
        recipient_already_registered=recipient_registered,
    )
    logger.info(
        "[deck-share] invite created token=%s to=%s registered=%s",
        token_str[:12],
        recipient_email_normalized,
        recipient_registered,
    )
    logger.debug("[deck-share] email html (preview): %s", html[:500])

    topic_title = topic.topic_display_name or "Колода"
    plain = (
        f"Вам передали колоду «{topic_title}» в EduLab.\n\n"
        f"Откройте ссылку, чтобы забрать колоду:\n{universal}\n\n"
        f"Если вы уже зарегистрированы: {registered_deep}\n"
        f"Если нет — регистрация: {new_user_link}\n"
    )
    email_sent = try_send_html_email(
        to_address=recipient_email_normalized,
        subject=f"Вам передали колоду: {topic_title}",
        html_body=html,
        text_body=plain,
    )

    return {
        "message": (
            "Приглашение отправлено на почту"
            if email_sent
            else "Ссылка для получения колоды сформирована (письмо не отправлено — проверьте SMTP на сервере)"
        ),
        "share_token": token_str,
        "share_url": universal,
        "email_sent": email_sent,
        "links": {
            "universal": universal,
            "registered_user_dashboard": registered_deep,
            "new_user_register": new_user_link,
        },
        "recipient_registered": recipient_registered,
        "expires_at": expires.isoformat() + "Z",
    }


def accept_deck_share_token_for_user(
    database_session_instance: Session,
    *,
    share_token: str,
    recipient_user_account_identifier: int,
) -> LearningTopicModel:
    """Поглощает токен: клонирует колоду получателю (email должен совпадать)."""
    row = database_session_instance.get(DeckShareTokenModel, share_token)
    if row is None:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    if row.consumed_at is not None:
        raise HTTPException(status_code=400, detail="Ссылка уже использована")
    if datetime.utcnow() > row.expires_at:
        raise HTTPException(status_code=400, detail="Срок действия ссылки истёк")

    user = database_session_instance.get(
        UserAccountModel, int(recipient_user_account_identifier)
    )
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    user_email = _normalize_email_for_share(str(user.user_email_address))
    if user_email != row.recipient_email_normalized:
        raise HTTPException(
            status_code=403,
            detail="Это приглашение выдано на другой email",
        )

    new_topic = clone_topic_deck_to_recipient_user(
        database_session_instance,
        sharer_user_account_identifier=int(row.sharer_user_account_id),
        source_topic_unique_identifier=int(row.source_topic_unique_identifier),
        recipient_user_account_identifier=int(recipient_user_account_identifier),
    )
    row.consumed_at = datetime.utcnow()
    row.recipient_user_account_id = int(recipient_user_account_identifier)
    row.cloned_topic_unique_identifier = int(new_topic.topic_unique_identifier)
    database_session_instance.add(row)
    database_session_instance.commit()
    database_session_instance.refresh(new_topic)
    return new_topic


def get_deck_share_token_preview(
    database_session_instance: Session, share_token: str
) -> dict:
    """Публичное превью по токену (без авторизации)."""
    row = database_session_instance.get(DeckShareTokenModel, share_token)
    if row is None:
        return {"valid": False}
    if row.consumed_at is not None or datetime.utcnow() > row.expires_at:
        return {"valid": False, "expired_or_used": True}
    topic = database_session_instance.get(
        LearningTopicModel, int(row.source_topic_unique_identifier)
    )
    sharer = database_session_instance.get(
        UserAccountModel, int(row.sharer_user_account_id)
    )
    return {
        "valid": True,
        "topic_title": topic.topic_display_name if topic else None,
        "recipient_email_hint": row.recipient_email_normalized,
        "expires_at": row.expires_at.isoformat() + "Z",
        "sharer_name": (
            sharer.user_full_display_name if sharer else None
        ),
    }
