"""
Эндпоинты сессий обучения: ответы на карточки, SM-2.
"""
from __future__ import annotations

import logging
import os
import statistics
from datetime import datetime, timedelta
from math import sqrt

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, case, cast, Float, func, or_, select

from app.api.dependencies import get_current_authorized_user_object
from app.database import get_database_session_generator
from app.models.learning_card import LearningCardModel
from app.models.learning_interaction import (
    LearningInteractionModel,
    UserSubjectiveConfidenceLevelEnum,
)
from app.models.user_account import UserAccountModel
from app.models.user_card_progress import UserCardProgressModel
from app.models.learning_topic import LearningTopicModel
from app.schemas.study import SessionFinishPayload, UserAnswerSubmission
from app.services.math_engine import (
    calculate_forgetting_rate,
    calculate_session_efficiency_eta,
    calculate_session_delta_t_hours,
    calculate_topic_entropy,
    run_sm2_step,
    update_energy,
)
from app.services.math_metrics import (
    calculate_learning_efficiency,
    calculate_readiness_index,
)
from app.services.user_analytics_service import refresh_user_global_stats

logger = logging.getLogger(__name__)
study_session_router = APIRouter(prefix="/study", tags=["Сессия обучения"])


def _get_topic_entropy_value_from_topic(topic_instance: object) -> float:
    """
    Извлекает topic_entropy_value из темы для расчёта SM-2.
    Использует topic_entropy_value (ИП) или topic_entropy_complexity_value.
    """
    return float(
        getattr(
            topic_instance,
            "topic_entropy_value",
            getattr(topic_instance, "topic_entropy_complexity_value", 0.0),
        )
    )


def _calculate_dynamic_topic_entropy_value_from_history(
    database_session_instance: Session,
    user_id: int,
    topic_instance: LearningTopicModel,
    *,
    default_pi_value: float = 0.5,
) -> float:
    """
    Гравитация темы H(T) через вероятность ошибки pi по истории.

    Подтемы: принимаем "подтемой" каждую карточку в рамках темы.
    Для каждой карточки:
      pi = wrong_count / total_count,
    а если истории нет — pi = 0.5.

    C (кол-во связей) берётся из learning_topics.related_topics_count.
    """
    topic_id_value = int(topic_instance.topic_unique_identifier)
    connections_count_c = int(getattr(topic_instance, "related_topics_count", 0) or 0)

    card_id_rows = database_session_instance.execute(
        select(LearningCardModel.card_unique_identifier).where(
            LearningCardModel.owner_user_account_id == user_id,
            LearningCardModel.parent_topic_reference_id == topic_id_value,
        )
    ).scalars().all()
    card_ids = [int(x) for x in card_id_rows]

    if not card_ids:
        # Если нет карточек в теме — берём "легкую" дефолтную вероятность ошибки.
        return calculate_topic_entropy([default_pi_value], connections_count_c)

    wrong_count_query = func.sum(
        case(
            (
                LearningInteractionModel.interaction_is_correct.is_(False),
                1,
            ),
            else_=0,
        )
    )
    total_count_query = func.count(LearningInteractionModel.interaction_unique_identifier)

    aggregation_rows = database_session_instance.execute(
        select(
            LearningInteractionModel.interaction_target_card_unique_identifier,
            wrong_count_query.label("wrong_count"),
            total_count_query.label("total_count"),
        ).where(
            LearningInteractionModel.interaction_owner_user_account_id == user_id,
            LearningInteractionModel.interaction_target_card_unique_identifier.in_(
                card_ids
            ),
        ).group_by(
            LearningInteractionModel.interaction_target_card_unique_identifier
        )
    ).all()

    per_card_agg: dict[int, tuple[int, int]] = {}
    for row in aggregation_rows:
        cid_value = int(row[0])
        per_card_agg[cid_value] = (int(row.wrong_count or 0), int(row.total_count or 0))

    error_rates_pi_list: list[float] = []
    for cid in card_ids:
        wrong_total = per_card_agg.get(cid)
        if not wrong_total:
            error_rates_pi_list.append(float(default_pi_value))
            continue
        wrong_count_value, total_count_value = wrong_total
        if total_count_value <= 0:
            error_rates_pi_list.append(float(default_pi_value))
        else:
            error_rates_pi_list.append(
                float(wrong_count_value) / float(total_count_value)
            )

    return calculate_topic_entropy(
        error_rates_pi_list, connections_count_c, alpha=0.1
    )


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


def _redis_client_optional():
    try:
        import redis as redis_library
    except ModuleNotFoundError:
        return None
    try:
        client = redis_library.Redis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            decode_responses=True,
        )
        # Проверка доступности: если Redis не поднят, работаем без него.
        client.ping()
        return client
    except Exception:
        return None


def _session_reset_redis_keys(user_id: int) -> float:
    """E=100, cards_done=0, TTL 2 ч."""
    r = _redis_client_optional()
    if r is None:
        return 100.0
    ttl = 2 * 60 * 60
    r.set(f"session:{user_id}:energy", "100", ex=ttl)
    r.set(f"session:{user_id}:cards_done", "0", ex=ttl)
    r.set(f"session:{user_id}:answers_total", "0", ex=ttl)
    r.set(f"session:{user_id}:answers_correct", "0", ex=ttl)
    r.set(
        f"session:{user_id}:started_at_ts",
        str(datetime.utcnow().timestamp()),
        ex=ttl,
    )
    return 100.0


def _calculate_user_lambda_i_from_interactions_history(
    database_session_instance: Session,
    user_id: int,
) -> float:
    """
    λ_i — персональный коэффициент забывания по истории Interactions.

    По 239-протоколу:
      λ_i = 0.05 + 0.3⋅(1−A_i) − 0.1⋅(1−σ_t_norm)
    где A_i — точность, σ_t — разброс времени ответа.
    """
    total_count_query = func.count(
        LearningInteractionModel.interaction_unique_identifier
    )
    correct_count_query = func.sum(
        case(
            (
                LearningInteractionModel.interaction_is_correct.is_(True),
                1,
            ),
            else_=0,
        )
    )
    # σ_t считаем по правильным ответам (как в learning_orchestrator).
    mean_time_query = func.avg(
        case(
            (
                LearningInteractionModel.interaction_is_correct.is_(True),
                cast(LearningInteractionModel.interaction_response_time_ms, Float),
            ),
            else_=None,
        )
    )
    mean_square_time_query = func.avg(
        case(
            (
                LearningInteractionModel.interaction_is_correct.is_(True),
                cast(LearningInteractionModel.interaction_response_time_ms, Float)
                * cast(LearningInteractionModel.interaction_response_time_ms, Float),
            ),
            else_=None,
        )
    )

    row = database_session_instance.execute(
        select(
            total_count_query.label("total_count"),
            correct_count_query.label("correct_count"),
            mean_time_query.label("mean_time"),
            mean_square_time_query.label("mean_square_time"),
        ).where(LearningInteractionModel.interaction_owner_user_account_id == user_id)
    ).one()

    total_count_value = int(row.total_count or 0)
    correct_count_value = int(row.correct_count or 0)
    accuracy_value = (
        correct_count_value / float(total_count_value)
        if total_count_value > 0
        else 0.0
    )

    mean_time_value = float(row.mean_time or 0.0)
    mean_square_time_value = float(row.mean_square_time or 0.0)
    variance_value = max(0.0, mean_square_time_value - mean_time_value**2)
    response_time_std_ms_value = sqrt(variance_value)

    return calculate_forgetting_rate(
        accuracy=accuracy_value, response_time_std_ms=response_time_std_ms_value
    )


def _calculate_user_lambda_i_including_current_interaction(
    database_session_instance: Session,
    *,
    user_id: int,
    submitted_answer_is_correct: bool,
    response_thinking_time_ms_value: int,
    topic_id_value: int,
) -> float:
    """
    λ_i с учётом текущего ответа (виртуально добавляем 1 запись в статистику).
    Это нужно, чтобы "сжатие" интервала и откат реакции были мгновенными.
    """
    total_count_query = func.count(
        LearningInteractionModel.interaction_unique_identifier
    )
    correct_count_query = func.sum(
        case(
            (
                LearningInteractionModel.interaction_is_correct.is_(True),
                1,
            ),
            else_=0,
        )
    )

    mean_time_correct_query = func.avg(
        case(
            (
                LearningInteractionModel.interaction_is_correct.is_(True),
                cast(LearningInteractionModel.interaction_response_time_ms, Float),
            ),
            else_=None,
        )
    )
    mean_square_time_correct_query = func.avg(
        case(
            (
                LearningInteractionModel.interaction_is_correct.is_(True),
                cast(LearningInteractionModel.interaction_response_time_ms, Float)
                * cast(LearningInteractionModel.interaction_response_time_ms, Float),
            ),
            else_=None,
        )
    )

    row = database_session_instance.execute(
        select(
            total_count_query.label("total_count"),
            correct_count_query.label("correct_count"),
            mean_time_correct_query.label("mean_time_correct"),
            mean_square_time_correct_query.label(
                "mean_square_time_correct"
            ),
        )
        .select_from(LearningInteractionModel)
        .join(
            LearningCardModel,
            LearningCardModel.card_unique_identifier
            == LearningInteractionModel.interaction_target_card_unique_identifier,
        )
        .where(
            LearningInteractionModel.interaction_owner_user_account_id == user_id,
            LearningCardModel.parent_topic_reference_id == topic_id_value,
        )
    ).one()

    total_count_value = int(row.total_count or 0)
    correct_count_value = int(row.correct_count or 0)

    total_count_new = total_count_value + 1
    correct_count_new = correct_count_value + (
        1 if submitted_answer_is_correct else 0
    )

    accuracy_new_value = (
        correct_count_new / float(total_count_new)
        if total_count_new > 0
        else 0.0
    )

    # σ_t считается по разбросу правильных ответов.
    correct_mean_time_value = float(row.mean_time_correct or 0.0)
    correct_mean_square_value = float(row.mean_square_time_correct or 0.0)

    if submitted_answer_is_correct:
        correct_count_old = max(0, correct_count_value)
        correct_count_target = max(1, correct_count_new)

        mean_new = (
            correct_mean_time_value * float(correct_count_old)
            + float(response_thinking_time_ms_value)
        ) / float(correct_count_target)

        mean_square_new = (
            correct_mean_square_value * float(correct_count_old)
            + float(response_thinking_time_ms_value * response_thinking_time_ms_value)
        ) / float(correct_count_target)

        variance_new = max(0.0, mean_square_new - mean_new**2)
        response_time_std_ms_value = sqrt(variance_new)
    else:
        variance_old = max(
            0.0, correct_mean_square_value - correct_mean_time_value**2
        )
        response_time_std_ms_value = sqrt(variance_old)

    return calculate_forgetting_rate(
        accuracy=accuracy_new_value, response_time_std_ms=response_time_std_ms_value
    )


def _increment_session_cards_done_redis(user_id: int) -> None:
    r = _redis_client_optional()
    if r is None:
        return
    key = f"session:{user_id}:cards_done"
    r.incr(key)
    r.expire(key, 2 * 60 * 60)


def _increment_session_answers_redis(user_id: int, is_correct: bool) -> None:
    """Счетчики ответов сессии: total/correct для итогового Summary."""
    r = _redis_client_optional()
    if r is None:
        return
    total_key = f"session:{user_id}:answers_total"
    correct_key = f"session:{user_id}:answers_correct"
    r.incr(total_key)
    if is_correct:
        r.incr(correct_key)
    r.expire(total_key, 2 * 60 * 60)
    r.expire(correct_key, 2 * 60 * 60)


def _get_session_cards_done_redis(user_id: int) -> int:
    r = _redis_client_optional()
    if r is None:
        return 0
    v = r.get(f"session:{user_id}:cards_done")
    return int(v) if v is not None else 0


def _subject_title_for_topic(
    database_session_instance: Session,
    topic_instance: LearningTopicModel | None,
) -> str:
    if topic_instance is None:
        return "Обучение"
    pid = getattr(topic_instance, "parent_topic_reference_identifier", None)
    if pid is None:
        return topic_instance.topic_display_name
    parent = database_session_instance.get(LearningTopicModel, int(pid))
    if parent is None:
        return topic_instance.topic_display_name
    return parent.topic_display_name


def _serialize_card_for_session(
    card: LearningCardModel,
    database_session_instance: Session,
) -> dict:
    topic = card.parent_topic
    subject = _subject_title_for_topic(database_session_instance, topic)
    topic_title = topic.topic_display_name if topic else "Тема"
    return {
        "card_id": card.card_unique_identifier,
        "question_text": card.card_question_text_payload,
        "answer_text": card.card_answer_text_payload,
        "card_type": card.card_type.value,
        "topic_title": topic_title,
        "subject": subject,
    }


@study_session_router.post("/session-start")
def study_session_start_endpoint(
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_student_user_account: UserAccountModel = Depends(
        get_current_authorized_user_object
    ),
):
    """
    POST /study/session-start.
    Сбрасывает E=100 и счётчик карточек в Redis (TTL 2 ч).
    """
    user_id = authorized_student_user_account.user_unique_identifier
    ri_before_value = float(
        authorized_student_user_account.last_calculated_readiness_index_ri or 0.0
    )
    avg_mastery_before = (
        database_connection_session.execute(
            select(func.avg(UserCardProgressModel.progress_mastery_level)).where(
                UserCardProgressModel.progress_owner_user_account_id == user_id
            )
        ).scalar()
        or 0.0
    )
    energy = _session_reset_redis_keys(user_id)

    # Этап подготовки: вычисляем "гравитацию" памяти пользователя (λ_i)
    # и ограничение по времени сессии (Δt) до показа карточек.
    r = _redis_client_optional()
    if r is not None:
        ttl = 2 * 60 * 60
        lambda_i_value = _calculate_user_lambda_i_from_interactions_history(
            database_connection_session=database_connection_session,
            user_id=user_id,
        )
        r.set(
            f"session:{user_id}:lambda_i",
            str(lambda_i_value),
            ex=ttl,
        )

        delta_t_hours_value = calculate_session_delta_t_hours(energy)
        deadline_ts_value = (
            datetime.utcnow().timestamp() + delta_t_hours_value * 3600.0
        )
        r.set(
            f"session:{user_id}:deadline_ts",
            str(deadline_ts_value),
            ex=ttl,
        )
        r.set(f"session:{user_id}:ri_before", str(ri_before_value), ex=ttl)
        r.set(
            f"session:{user_id}:mastery_before",
            str(float(avg_mastery_before)),
            ex=ttl,
        )
    return {
        "ok": True,
        "energy": energy,
        "ri_before": float(ri_before_value),
        "started_at_ts": float(datetime.utcnow().timestamp()),
    }


@study_session_router.get("/next-card")
def study_session_next_card_endpoint(
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_student_user_account: UserAccountModel = Depends(
        get_current_authorized_user_object
    ),
):
    """
    GET /study/next-card.
    Следующая карточка к повторению (нет progress или next_review <= сейчас).
    """
    user_id = authorized_student_user_account.user_unique_identifier
    current_energy, redis_client_instance = (
        _retrieve_or_initialize_user_energy_value_from_redis(user_id)
    )
    if current_energy <= 0.0:
        return {"finished": True, "session": None}

    # Этап подготовки: если ограничение по времени Δt истекло — завершаем сессию.
    if redis_client_instance is not None:
        deadline_ts_string = redis_client_instance.get(
            f"session:{user_id}:deadline_ts"
        )
        if deadline_ts_string is not None:
            now_ts = datetime.utcnow().timestamp()
            if now_ts >= float(deadline_ts_string):
                return {"finished": True, "session": None}

    now = datetime.utcnow()

    due_filter = and_(
        LearningCardModel.owner_user_account_id == user_id,
        or_(
            UserCardProgressModel.progress_next_review_date.is_(None),
            UserCardProgressModel.progress_next_review_date <= now,
        ),
    )

    count_stmt = (
        select(func.count())
        .select_from(LearningCardModel)
        .outerjoin(
            UserCardProgressModel,
            and_(
                UserCardProgressModel.progress_target_card_unique_identifier
                == LearningCardModel.card_unique_identifier,
                UserCardProgressModel.progress_owner_user_account_id == user_id,
            ),
        )
        .where(due_filter)
    )
    total_due = database_connection_session.execute(count_stmt).scalar() or 0

    stmt = (
        select(LearningCardModel)
        .options(joinedload(LearningCardModel.parent_topic))
        .outerjoin(
            UserCardProgressModel,
            and_(
                UserCardProgressModel.progress_target_card_unique_identifier
                == LearningCardModel.card_unique_identifier,
                UserCardProgressModel.progress_owner_user_account_id == user_id,
            ),
        )
        .where(due_filter)
        .order_by(
            func.coalesce(
                UserCardProgressModel.progress_next_review_date,
                datetime(1970, 1, 1),
            ).asc(),
            LearningCardModel.card_unique_identifier.asc(),
        )
        .limit(1)
    )
    row = database_connection_session.execute(stmt).scalars().first()

    cards_done = _get_session_cards_done_redis(user_id)
    energy = float(current_energy)

    if row is None:
        return {
            "finished": False,
            "card": None,
            "session": {
                "energy": energy,
                "cards_done": cards_done,
                "cards_total": int(total_due),
            },
        }

    return {
        "finished": False,
        "card": _serialize_card_for_session(row, database_connection_session),
        "session": {
            "energy": energy,
            "cards_done": cards_done,
            "cards_total": int(total_due),
        },
    }


@study_session_router.get("/topic/{topic_id}/next-card")
def study_session_next_card_for_topic_endpoint(
    topic_id: int,
    include_future: bool = False,
    exclude_card_ids: str | None = None,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_student_user_account: UserAccountModel = Depends(
        get_current_authorized_user_object
    ),
):
    """
    GET /study/topic/{topic_id}/next-card.
    Следующая карточка к повторению в рамках одной темы.
    """
    user_id = authorized_student_user_account.user_unique_identifier
    current_energy, redis_client_instance = (
        _retrieve_or_initialize_user_energy_value_from_redis(user_id)
    )
    if current_energy <= 0.0:
        return {"finished": True, "session": None}

    if redis_client_instance is not None:
        deadline_ts_string = redis_client_instance.get(
            f"session:{user_id}:deadline_ts"
        )
        if deadline_ts_string is not None:
            now_ts = datetime.utcnow().timestamp()
            if now_ts >= float(deadline_ts_string):
                return {"finished": True, "session": None}

    now = datetime.utcnow()
    base_filter = and_(
        LearningCardModel.owner_user_account_id == user_id,
        LearningCardModel.parent_topic_reference_id == int(topic_id),
    )
    excluded: set[int] = set()
    if exclude_card_ids:
        for part in exclude_card_ids.split(","):
            p = part.strip()
            if not p:
                continue
            try:
                excluded.add(int(p))
            except ValueError:
                continue
    due_filter = and_(
        base_filter,
        or_(
            UserCardProgressModel.progress_next_review_date.is_(None),
            UserCardProgressModel.progress_next_review_date <= now,
        ),
    )

    count_stmt = (
        select(func.count())
        .select_from(LearningCardModel)
        .outerjoin(
            UserCardProgressModel,
            and_(
                UserCardProgressModel.progress_target_card_unique_identifier
                == LearningCardModel.card_unique_identifier,
                UserCardProgressModel.progress_owner_user_account_id == user_id,
            ),
        )
        .where(due_filter)
    )
    total_due = database_connection_session.execute(count_stmt).scalar() or 0

    stmt = (
        select(LearningCardModel)
        .options(joinedload(LearningCardModel.parent_topic))
        .outerjoin(
            UserCardProgressModel,
            and_(
                UserCardProgressModel.progress_target_card_unique_identifier
                == LearningCardModel.card_unique_identifier,
                UserCardProgressModel.progress_owner_user_account_id == user_id,
            ),
        )
        .where(due_filter)
        .order_by(
            func.coalesce(
                UserCardProgressModel.progress_next_review_date,
                datetime(1970, 1, 1),
            ).asc(),
            LearningCardModel.card_unique_identifier.asc(),
        )
        .limit(1)
    )
    row = database_connection_session.execute(stmt).scalars().first()

    cards_done = _get_session_cards_done_redis(user_id)
    energy = float(current_energy)

    if row is None:
        if include_future:
            any_filter = base_filter
            if excluded:
                any_filter = and_(
                    base_filter,
                    LearningCardModel.card_unique_identifier.notin_(excluded),
                )
            any_stmt = (
                select(LearningCardModel)
                .options(joinedload(LearningCardModel.parent_topic))
                .outerjoin(
                    UserCardProgressModel,
                    and_(
                        UserCardProgressModel.progress_target_card_unique_identifier
                        == LearningCardModel.card_unique_identifier,
                        UserCardProgressModel.progress_owner_user_account_id
                        == user_id,
                    ),
                )
                .where(any_filter)
                .order_by(LearningCardModel.card_unique_identifier.asc())
                .limit(1)
            )
            any_row = (
                database_connection_session.execute(any_stmt).scalars().first()
            )
            if any_row is not None:
                payload = _serialize_card_for_session(
                    any_row, database_connection_session
                )
                payload["explanation_text"] = getattr(
                    any_row, "card_explanation_text", None
                )
                return {
                    "finished": False,
                    "card": payload,
                    "session": {
                        "energy": energy,
                        "cards_done": cards_done,
                        "cards_total": int(total_due),
                    },
                    "mode": "training",
                }
            # Тренировочный режим: карточки в теме закончились.
            return {
                "finished": True,
                "card": None,
                "session": {
                    "energy": energy,
                    "cards_done": cards_done,
                    "cards_total": int(total_due),
                },
                "mode": "training",
            }
        return {
            "finished": False,
            "card": None,
            "session": {
                "energy": energy,
                "cards_done": cards_done,
                "cards_total": int(total_due),
            },
        }

    payload = _serialize_card_for_session(row, database_connection_session)
    payload["explanation_text"] = getattr(row, "card_explanation_text", None)
    return {
        "finished": False,
        "card": payload,
        "session": {
            "energy": energy,
            "cards_done": cards_done,
            "cards_total": int(total_due),
        },
    }


@study_session_router.post("/submit-answer")
def submit_user_answer_endpoint(
    background_tasks: BackgroundTasks,
    submitted_answer_data_transfer_object: UserAnswerSubmission,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_student_user_account: UserAccountModel = Depends(
        get_current_authorized_user_object
    ),
):
    """
    POST /study/submit-answer.
    Обновляет энергию в Redis, выполняет модифицированный SM-2 и фиксирует
    Interactions/Progress. Проверка владения защищает от несанкционированных
    изменений чужих данных.
    """
    updated_learning_card_instance = _fetch_card_and_validate_ownership(
        database_session_instance=database_connection_session,
        card_identifier=submitted_answer_data_transfer_object.target_card_unique_identifier,
        user_identifier=authorized_student_user_account.user_unique_identifier,
    )
    if updated_learning_card_instance is None:
        raise HTTPException(status_code=404, detail="Карточка не найдена")

    submitted_answer_is_correct = bool(
        submitted_answer_data_transfer_object.submitted_user_answer_is_correct
    )
    submitted_user_subjective_confidence_score = float(
        submitted_answer_data_transfer_object.user_subjective_confidence_score
    )
    response_thinking_time_ms_value = int(
        submitted_answer_data_transfer_object.response_thinking_time_seconds
        * 1000.0
    )
    calculated_question_quality_q_value = (
        _calculate_quality_q_value_from_is_correct_and_confidence(
            submitted_answer_is_correct=submitted_answer_is_correct,
            submitted_user_subjective_confidence_score=submitted_user_subjective_confidence_score,
        )
    )
    remaining_user_cognitive_energy = (
        _apply_energy_update_in_redis_or_initialize(
            database_session_instance=database_connection_session,
            authorized_student_user_account=authorized_student_user_account,
            response_thinking_time_ms=response_thinking_time_ms_value,
            question_quality_q_value=submitted_user_subjective_confidence_score,
            submitted_answer_is_correct=submitted_answer_is_correct,
        )
    )

    if remaining_user_cognitive_energy <= 0.0:
        existing_progress_record = _fetch_user_card_progress_record(
            database_session_instance=database_connection_session,
            authorized_student_user_account_identifier=authorized_student_user_account.user_unique_identifier,
            learning_card_identifier=updated_learning_card_instance.card_unique_identifier,
        )
        next_review_date_value = (
            updated_learning_card_instance.card_next_review_datetime.date()
            if updated_learning_card_instance.card_next_review_datetime is not None
            else datetime.utcnow().date()
        )
        new_mastery_value = (
            int(existing_progress_record.progress_mastery_level)
            if existing_progress_record is not None
            else 0
        )
        _increment_session_cards_done_redis(
            authorized_student_user_account.user_unique_identifier
        )
        _increment_session_answers_redis(
            authorized_student_user_account.user_unique_identifier,
            bool(submitted_answer_data_transfer_object.submitted_user_answer_is_correct),
        )
        return {
            "session_completed": True,
            "is_correct": submitted_answer_data_transfer_object.submitted_user_answer_is_correct,
            "energy_left": remaining_user_cognitive_energy,
            "next_review": next_review_date_value,
            "new_mastery": new_mastery_value,
            "topic_unique_identifier": getattr(
                updated_learning_card_instance.parent_topic,
                "topic_unique_identifier",
                None,
            ),
            "topic_display_name": getattr(
                updated_learning_card_instance.parent_topic,
                "topic_display_name",
                None,
            ),
            "topic_mastery_before": float(new_mastery_value),
            "topic_mastery_after": float(new_mastery_value),
        }

    # calculated_question_quality_q_value вычислен выше.
    user_id = authorized_student_user_account.user_unique_identifier
    redis_client_instance = _redis_client_optional()
    ttl_seconds_value = 2 * 60 * 60

    # Этап процесса: λ_i нужно обновить "мгновенно" с учётом текущего ответа,
    # чтобы неверный клик сразу сжал интервал и UI успел показать откат.
    topic_id_value = int(updated_learning_card_instance.parent_topic_reference_id)
    user_personal_forgetting_lambda_from_account = (
        _calculate_user_lambda_i_including_current_interaction(
            database_session_instance=database_connection_session,
            user_id=user_id,
            submitted_answer_is_correct=submitted_answer_is_correct,
            response_thinking_time_ms_value=response_thinking_time_ms_value,
            topic_id_value=topic_id_value,
        )
    )

    # Этап подготовки: вычисляем гравитацию темы H(T) из истории ошибок.
    topic_instance_value = updated_learning_card_instance.parent_topic
    if topic_instance_value is None:
        topic_entropy_value_for_sm2 = 0.0
    else:
        topic_id_value = int(topic_instance_value.topic_unique_identifier)
        topic_entropy_key = f"session:{user_id}:topic_entropy:{topic_id_value}"
        topic_entropy_string = (
            redis_client_instance.get(topic_entropy_key)
            if redis_client_instance is not None
            else None
        )
        if topic_entropy_string is not None:
            topic_entropy_value_for_sm2 = float(topic_entropy_string)
        else:
            topic_entropy_value_for_sm2 = (
                _calculate_dynamic_topic_entropy_value_from_history(
                    database_session_instance=database_connection_session,
                    user_id=user_id,
                    topic_instance=topic_instance_value,
                )
            )
            if redis_client_instance is not None:
                redis_client_instance.set(
                    topic_entropy_key,
                    str(topic_entropy_value_for_sm2),
                    ex=ttl_seconds_value,
                )

    calculated_new_easiness_factor, repetition_interval_days_count = run_sm2_step(
        confidence_score_q=int(calculated_question_quality_q_value),
        previous_easiness_factor_ef=_fetch_or_initialize_user_progress_easiness_factor(
            database_session_instance=database_connection_session,
            authorized_student_user_account_identifier=authorized_student_user_account.user_unique_identifier,
            learning_card_identifier=updated_learning_card_instance.card_unique_identifier,
            fallback_easiness_factor_value=updated_learning_card_instance.card_easiness_factor_ef,
        ),
        repetition_sequence_number=updated_learning_card_instance.card_repetition_sequence_number,
        previous_interval_days_count=updated_learning_card_instance.card_last_interval_days,
        calculated_topic_entropy_value=topic_entropy_value_for_sm2,
        user_personal_forgetting_coefficient=user_personal_forgetting_lambda_from_account,
        response_thinking_time_ms=response_thinking_time_ms_value,
    )

    updated_next_review_datetime, updated_topic_mastery_average_int, previous_topic_mastery_average_value = (
        _create_interaction_and_update_progress_and_topic_mastery_average(
            database_session_instance=database_connection_session,
            authorized_student_user_account=authorized_student_user_account,
            updated_learning_card_instance=updated_learning_card_instance,
            submitted_answer_is_correct=submitted_answer_data_transfer_object.submitted_user_answer_is_correct,
            submitted_user_subjective_confidence_score=submitted_answer_data_transfer_object.user_subjective_confidence_score,
            time_spent_on_thinking_seconds=submitted_answer_data_transfer_object.response_thinking_time_seconds,
            calculated_question_quality_q_value=calculated_question_quality_q_value,
            calculated_new_easiness_factor=calculated_new_easiness_factor,
            repetition_interval_days_count=repetition_interval_days_count,
        )
    )

    session_duration_hours_value = 25.0 / 60.0
    background_tasks.add_task(
        _calculate_eta_and_ri_background_task,
        authorized_student_user_account_identifier=authorized_student_user_account.user_unique_identifier,
        initial_mastery=previous_topic_mastery_average_value,
        final_mastery=float(updated_topic_mastery_average_int),
        session_duration_hours=session_duration_hours_value,
    )

    _increment_session_cards_done_redis(
        authorized_student_user_account.user_unique_identifier
    )
    _increment_session_answers_redis(
        authorized_student_user_account.user_unique_identifier,
        bool(submitted_answer_data_transfer_object.submitted_user_answer_is_correct),
    )

    return {
        "is_correct": submitted_answer_data_transfer_object.submitted_user_answer_is_correct,
        "energy_left": remaining_user_cognitive_energy,
        "next_review": updated_next_review_datetime.date(),
        "new_mastery": updated_topic_mastery_average_int,
        "topic_unique_identifier": int(
            updated_learning_card_instance.parent_topic_reference_id
        ),
        "topic_display_name": (
            updated_learning_card_instance.parent_topic.topic_display_name
            if updated_learning_card_instance.parent_topic is not None
            else None
        ),
        "topic_mastery_before": float(previous_topic_mastery_average_value),
        "topic_mastery_after": float(updated_topic_mastery_average_int),
    }


@study_session_router.post("/process-answer")
def process_answer_endpoint(
    background_tasks: BackgroundTasks,
    submitted_answer_data_transfer_object: UserAnswerSubmission,
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_student_user_account: UserAccountModel = Depends(
        get_current_authorized_user_object
    ),
):
    """
    POST /study/process-answer.
    Единый pipeline обработки ответа + флаг suggest_break для фронта.
    """
    result = submit_user_answer_endpoint(
        background_tasks=background_tasks,
        submitted_answer_data_transfer_object=submitted_answer_data_transfer_object,
        database_connection_session=database_connection_session,
        authorized_student_user_account=authorized_student_user_account,
    )

    user_id = authorized_student_user_account.user_unique_identifier
    energy_left = float(result.get("energy_left", 0.0))

    suggest_break = energy_left < 10.0
    redis_client_instance = _redis_client_optional()
    if redis_client_instance is not None:
        deadline_ts_string = redis_client_instance.get(
            f"session:{user_id}:deadline_ts"
        )
        if deadline_ts_string is not None:
            now_ts = datetime.utcnow().timestamp()
            if now_ts >= float(deadline_ts_string):
                suggest_break = True

    return {
        **result,
        "suggest_break": bool(suggest_break),
    }


@study_session_router.post("/session-finish")
def finish_session_endpoint(
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_student_user_account: UserAccountModel = Depends(
        get_current_authorized_user_object
    ),
    payload: SessionFinishPayload | None = Body(default=None),
):
    """
    POST /study/session-finish.
    Возвращает summary с η, ΔRI, точностью и временем сессии.

    Если передан ``payload.interactions``, точность и суммарное время
    раздумий берутся оттуда (надёжно при отключённом Redis).
    ``ri_before_snapshot`` фиксирует RI в начале сессии для ΔRI.
    """
    user_id = authorized_student_user_account.user_unique_identifier
    redis_client = _redis_client_optional()

    started_ts = datetime.utcnow().timestamp()
    answers_total = 0
    answers_correct = 0
    ri_before = float(
        authorized_student_user_account.last_calculated_readiness_index_ri or 0.0
    )
    mastery_before = 0.0

    if redis_client is not None:
        redis_started = redis_client.get(f"session:{user_id}:started_at_ts")
        if redis_started is not None:
            started_ts = float(redis_started)
        answers_total = int(redis_client.get(f"session:{user_id}:answers_total") or 0)
        answers_correct = int(
            redis_client.get(f"session:{user_id}:answers_correct") or 0
        )
        redis_ri = redis_client.get(f"session:{user_id}:ri_before")
        if redis_ri is not None:
            ri_before = float(redis_ri)
        mastery_before = float(
            redis_client.get(f"session:{user_id}:mastery_before") or 0.0
        )

    if payload is not None and payload.ri_before_snapshot is not None:
        ri_before = float(payload.ri_before_snapshot)
    if payload is not None and payload.started_at_ts is not None:
        started_ts = float(payload.started_at_ts)

    total_response_time_ms = 0
    if payload is not None and payload.interactions is not None:
        answers_total = len(payload.interactions)
        answers_correct = sum(1 for x in payload.interactions if x.is_correct)
        total_response_time_ms = int(
            sum(int(x.response_time_ms) for x in payload.interactions)
        )

    now_ts = datetime.utcnow().timestamp()
    session_hours = max(0.0, (now_ts - started_ts) / 3600.0)
    session_minutes = max(0.0, (now_ts - started_ts) / 60.0)

    refresh_user_global_stats(
        database_session_instance=database_connection_session,
        target_user_account_identifier=user_id,
    )
    database_connection_session.refresh(authorized_student_user_account)
    ri_after = float(
        authorized_student_user_account.last_calculated_readiness_index_ri or 0.0
    )

    avg_mastery_after = (
        database_connection_session.execute(
            select(func.avg(UserCardProgressModel.progress_mastery_level)).where(
                UserCardProgressModel.progress_owner_user_account_id == user_id
            )
        ).scalar()
        or 0.0
    )

    unique_topics_count = (
        database_connection_session.execute(
            select(func.count(func.distinct(LearningCardModel.parent_topic_reference_id)))
            .select_from(LearningInteractionModel)
            .join(
                LearningCardModel,
                LearningCardModel.card_unique_identifier
                == LearningInteractionModel.interaction_target_card_unique_identifier,
            )
            .where(
                LearningInteractionModel.interaction_owner_user_account_id == user_id,
                LearningInteractionModel.interaction_timestamp
                >= datetime.utcfromtimestamp(started_ts),
            )
        ).scalar()
        or 1
    )

    eta_value = 0.0
    if session_hours > 1e-9:
        eta_value = calculate_session_efficiency_eta(
            initial_mastery_m0=float(mastery_before),
            final_mastery=float(avg_mastery_after),
            session_duration_hours=float(session_hours),
            unique_topics_count_k=int(unique_topics_count),
        )

    accuracy_percent = (
        (100.0 * float(answers_correct) / float(answers_total))
        if answers_total > 0
        else 0.0
    )

    return {
        "eta_percent": float(max(0.0, min(100.0, eta_value))),
        "delta_ri": float(ri_after - ri_before),
        "accuracy_correct": int(answers_correct),
        "accuracy_total": int(answers_total),
        "accuracy_percent": float(round(accuracy_percent, 1)),
        "session_minutes": float(session_minutes),
        "total_response_time_ms": int(total_response_time_ms),
        "ri_before": float(ri_before),
        "ri_after": float(ri_after),
        "energy_left": float(
            _retrieve_or_initialize_user_energy_value_from_redis(user_id)[0]
        ),
    }


@study_session_router.post("/refresh-user-stats")
def refresh_user_global_stats_endpoint(
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_student_user_account: UserAccountModel = Depends(
        get_current_authorized_user_object
    ),
):
    """
    POST /study/refresh-user-stats.
    Агрегирует данные из interactions и progress, обновляет
    total_learning_hours и last_calculated_readiness_index_ri в user_accounts.
    """
    success = refresh_user_global_stats(
        database_session_instance=database_connection_session,
        target_user_account_identifier=authorized_student_user_account.user_unique_identifier,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return {"status": "ok", "message": "Глобальная статистика обновлена"}


@study_session_router.get("/dashboard-insights")
def dashboard_insights_endpoint(
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_student_user_account: UserAccountModel = Depends(
        get_current_authorized_user_object
    ),
):
    """
    GET /study/dashboard-insights.
    Возвращает:
    - readiness_index_ri (0..1000), readiness_index_view (RI/10, 0..100);
    - дневной дельта-прирост;
    - список «слабых тем» (высокая энтропия + низкое mastery).
    """
    user_id = authorized_student_user_account.user_unique_identifier

    # Обновляем агрегаты перед чтением RI, чтобы фронт видел актуальные данные.
    refresh_user_global_stats(
        database_session_instance=database_connection_session,
        target_user_account_identifier=user_id,
    )
    database_connection_session.refresh(authorized_student_user_account)

    readiness_index_ri_value = float(
        authorized_student_user_account.last_calculated_readiness_index_ri or 0.0
    )
    # Шкала 0–100 для UI: RI_view = RI / 10 (модель RI ∈ [0..1000]).
    readiness_index_view_value = max(
        0.0, min(100.0, readiness_index_ri_value / 10.0)
    )

    # Простой daily delta: баланс правильных/неправильных ответов за 24ч.
    since_dt = datetime.utcnow() - timedelta(days=1)
    correct_recent = (
        database_connection_session.execute(
            select(
                func.sum(
                    case(
                        (
                            LearningInteractionModel.interaction_is_correct.is_(True),
                            1,
                        ),
                        else_=0,
                    )
                )
            ).where(
                LearningInteractionModel.interaction_owner_user_account_id
                == user_id,
                LearningInteractionModel.interaction_timestamp >= since_dt,
            )
        ).scalar()
        or 0
    )
    total_recent = (
        database_connection_session.execute(
            select(func.count()).where(
                LearningInteractionModel.interaction_owner_user_account_id
                == user_id,
                LearningInteractionModel.interaction_timestamp >= since_dt,
            )
        ).scalar()
        or 0
    )
    if total_recent <= 0:
        daily_delta = 0.0
    else:
        daily_delta = (float(correct_recent) / float(total_recent) - 0.5) * 24.0

    weak_topics_query = (
        select(
            LearningTopicModel.topic_unique_identifier,
            LearningTopicModel.topic_display_name,
            LearningTopicModel.topic_entropy_value,
            LearningTopicModel.topic_entropy_complexity_value,
            func.avg(UserCardProgressModel.progress_mastery_level).label(
                "avg_mastery"
            ),
        )
        .join(
            LearningCardModel,
            LearningCardModel.parent_topic_reference_id
            == LearningTopicModel.topic_unique_identifier,
        )
        .join(
            UserCardProgressModel,
            and_(
                UserCardProgressModel.progress_target_card_unique_identifier
                == LearningCardModel.card_unique_identifier,
                UserCardProgressModel.progress_owner_user_account_id == user_id,
            ),
            isouter=True,
        )
        .where(LearningTopicModel.topic_owner_user_id == user_id)
        .group_by(
            LearningTopicModel.topic_unique_identifier,
            LearningTopicModel.topic_display_name,
            LearningTopicModel.topic_entropy_value,
            LearningTopicModel.topic_entropy_complexity_value,
        )
        .order_by(
            func.coalesce(
                func.avg(UserCardProgressModel.progress_mastery_level),
                0.0,
            ).asc(),
        )
        .limit(24)
    )
    weak_topics_rows = database_connection_session.execute(weak_topics_query).all()

    weak_topics = []
    for row in weak_topics_rows:
        topic_model = database_connection_session.get(
            LearningTopicModel, int(row.topic_unique_identifier)
        )
        if topic_model is None:
            continue
        entropy_value = _calculate_dynamic_topic_entropy_value_from_history(
            database_session_instance=database_connection_session,
            user_id=user_id,
            topic_instance=topic_model,
        )
        avg_mastery_value = float(row.avg_mastery or 0.0)
        weak_topics.append(
            {
                "topic_unique_identifier": int(row.topic_unique_identifier),
                "topic_display_name": row.topic_display_name,
                "entropy": entropy_value,
                "avg_mastery": avg_mastery_value,
            }
        )

    weak_topics.sort(key=lambda item: (-item["entropy"], item["avg_mastery"]))

    return {
        "readiness_index_ri": readiness_index_ri_value,
        "readiness_index_view": readiness_index_view_value,
        "readiness_daily_delta": daily_delta,
        "weak_topics": weak_topics[:6],
    }


@study_session_router.get("/dashboard-home")
def dashboard_home_endpoint(
    database_connection_session: Session = Depends(get_database_session_generator),
    authorized_student_user_account: UserAccountModel = Depends(
        get_current_authorized_user_object
    ),
):
    """
    GET /study/dashboard-home.
    Агрегат для главного дашборда: метрики, зоны роста, колоды.
    """
    user_id = authorized_student_user_account.user_unique_identifier

    refresh_user_global_stats(
        database_session_instance=database_connection_session,
        target_user_account_identifier=user_id,
    )
    database_connection_session.refresh(authorized_student_user_account)

    readiness_index_ri_value = float(
        authorized_student_user_account.last_calculated_readiness_index_ri or 0.0
    )
    readiness_index_view_value = max(
        0.0, min(100.0, readiness_index_ri_value / 10.0)
    )

    since_dt = datetime.utcnow() - timedelta(days=1)
    correct_recent = (
        database_connection_session.execute(
            select(
                func.sum(
                    case(
                        (
                            LearningInteractionModel.interaction_is_correct.is_(True),
                            1,
                        ),
                        else_=0,
                    )
                )
            ).where(
                LearningInteractionModel.interaction_owner_user_account_id
                == user_id,
                LearningInteractionModel.interaction_timestamp >= since_dt,
            )
        ).scalar()
        or 0
    )
    total_recent = (
        database_connection_session.execute(
            select(func.count()).where(
                LearningInteractionModel.interaction_owner_user_account_id
                == user_id,
                LearningInteractionModel.interaction_timestamp >= since_dt,
            )
        ).scalar()
        or 0
    )
    if total_recent <= 0:
        daily_delta = 0.0
    else:
        daily_delta = (float(correct_recent) / float(total_recent) - 0.5) * 24.0

    since_week = datetime.utcnow() - timedelta(days=7)
    week_correct = (
        database_connection_session.execute(
            select(
                func.sum(
                    case(
                        (
                            LearningInteractionModel.interaction_is_correct.is_(True),
                            1,
                        ),
                        else_=0,
                    )
                )
            ).where(
                LearningInteractionModel.interaction_owner_user_account_id
                == user_id,
                LearningInteractionModel.interaction_timestamp >= since_week,
            )
        ).scalar()
        or 0
    )
    week_total = (
        database_connection_session.execute(
            select(func.count()).where(
                LearningInteractionModel.interaction_owner_user_account_id
                == user_id,
                LearningInteractionModel.interaction_timestamp >= since_week,
            )
        ).scalar()
        or 0
    )
    accuracy_week_pct = (
        round(100.0 * float(week_correct) / float(week_total))
        if week_total > 0
        else 0
    )

    total_interactions = int(
        database_connection_session.execute(
            select(func.count()).where(
                LearningInteractionModel.interaction_owner_user_account_id
                == user_id,
            )
        ).scalar()
        or 0
    )

    now_utc = datetime.utcnow()
    due_today_count = int(
        database_connection_session.execute(
            select(func.count())
            .select_from(UserCardProgressModel)
            .where(
                UserCardProgressModel.progress_owner_user_account_id == user_id,
                or_(
                    UserCardProgressModel.progress_next_review_date.is_(None),
                    UserCardProgressModel.progress_next_review_date <= now_utc,
                ),
            )
        ).scalar()
        or 0
    )

    ts_rows = database_connection_session.execute(
        select(LearningInteractionModel.interaction_timestamp).where(
            LearningInteractionModel.interaction_owner_user_account_id == user_id,
            LearningInteractionModel.interaction_timestamp.isnot(None),
        )
    ).scalars().all()
    date_set: set = set()
    for ts in ts_rows:
        if ts is None:
            continue
        d_val = ts.date() if hasattr(ts, "date") else ts
        date_set.add(d_val)
    streak_days = 0
    if date_set:
        max_d = max(date_set)
        d_cursor = max_d
        while d_cursor in date_set:
            streak_days += 1
            d_cursor -= timedelta(days=1)

    mastery_rows = database_connection_session.execute(
        select(UserCardProgressModel.progress_mastery_level).where(
            UserCardProgressModel.progress_owner_user_account_id == user_id,
        )
    ).scalars().all()
    mastery_levels = [float(x) for x in mastery_rows]
    if mastery_levels:
        mastery_mean = sum(mastery_levels) / float(len(mastery_levels))
        mastery_std = statistics.pstdev(mastery_levels)
    else:
        mastery_mean = 0.0
        mastery_std = 0.0
    sigma_norm = max(0.0, 1.0 - mastery_std / 25.0)
    hours_val = float(authorized_student_user_account.total_learning_hours or 0.0)
    mastery_avg_pct = int(round(max(0.0, min(100.0, mastery_mean))))
    sigma_norm_pct = int(round(max(0.0, min(100.0, sigma_norm * 100.0))))
    hours_rounded = int(round(hours_val))

    weak_topics_query = (
        select(
            LearningTopicModel.topic_unique_identifier,
            LearningTopicModel.topic_display_name,
            LearningTopicModel.topic_entropy_value,
            LearningTopicModel.topic_entropy_complexity_value,
            func.avg(UserCardProgressModel.progress_mastery_level).label(
                "avg_mastery"
            ),
        )
        .join(
            LearningCardModel,
            LearningCardModel.parent_topic_reference_id
            == LearningTopicModel.topic_unique_identifier,
        )
        .join(
            UserCardProgressModel,
            and_(
                UserCardProgressModel.progress_target_card_unique_identifier
                == LearningCardModel.card_unique_identifier,
                UserCardProgressModel.progress_owner_user_account_id == user_id,
            ),
            isouter=True,
        )
        .where(LearningTopicModel.topic_owner_user_id == user_id)
        .group_by(
            LearningTopicModel.topic_unique_identifier,
            LearningTopicModel.topic_display_name,
            LearningTopicModel.topic_entropy_value,
            LearningTopicModel.topic_entropy_complexity_value,
        )
        .order_by(
            func.coalesce(
                func.avg(UserCardProgressModel.progress_mastery_level),
                0.0,
            ).asc(),
        )
        .limit(24)
    )
    weak_rows = database_connection_session.execute(weak_topics_query).all()

    weak_topics: list[dict] = []
    for row in weak_rows:
        topic_model = database_connection_session.get(
            LearningTopicModel, int(row.topic_unique_identifier)
        )
        if topic_model is None:
            continue
        entropy_value = _calculate_dynamic_topic_entropy_value_from_history(
            database_session_instance=database_connection_session,
            user_id=user_id,
            topic_instance=topic_model,
        )
        avg_mastery_value = float(row.avg_mastery or 0.0)
        weak_topics.append(
            {
                "topic_unique_identifier": int(row.topic_unique_identifier),
                "topic_display_name": row.topic_display_name,
                "entropy": entropy_value,
                "avg_mastery": avg_mastery_value,
            }
        )
    weak_topics.sort(key=lambda item: (-item["entropy"], item["avg_mastery"]))

    zones_out: list[dict] = []
    for wt in weak_topics[:6]:
        m_int = int(round(max(0.0, min(100.0, wt["avg_mastery"]))))
        ent = float(wt["entropy"])
        if ent > 1.0 or m_int < 30:
            status = "warn"
        elif m_int < 60:
            status = "mid"
        else:
            status = "ok"
        zones_out.append(
            {
                "topic_id": int(wt["topic_unique_identifier"]),
                "name": wt["topic_display_name"],
                "mastery": m_int,
                "complexity": round(ent, 2),
                "status": status,
            }
        )

    weakest = min(zones_out, key=lambda z: z["mastery"]) if zones_out else None
    weak_topic_name = weakest["name"] if weakest else "—"
    weak_topic_mastery_pct = weakest["mastery"] if weakest else 0

    decks_query = (
        select(
            LearningTopicModel.topic_unique_identifier,
            LearningTopicModel.topic_display_name,
            LearningTopicModel.related_topics_count,
            LearningTopicModel.is_public_visibility,
            func.avg(UserCardProgressModel.progress_mastery_level).label("avg_m"),
        )
        .join(
            LearningCardModel,
            LearningCardModel.parent_topic_reference_id
            == LearningTopicModel.topic_unique_identifier,
        )
        .outerjoin(
            UserCardProgressModel,
            and_(
                UserCardProgressModel.progress_target_card_unique_identifier
                == LearningCardModel.card_unique_identifier,
                UserCardProgressModel.progress_owner_user_account_id == user_id,
            ),
        )
        .where(LearningTopicModel.topic_owner_user_id == user_id)
        .group_by(
            LearningTopicModel.topic_unique_identifier,
            LearningTopicModel.topic_display_name,
            LearningTopicModel.related_topics_count,
            LearningTopicModel.is_public_visibility,
        )
        .order_by(
            func.coalesce(
                func.avg(UserCardProgressModel.progress_mastery_level),
                0.0,
            ).asc(),
        )
        .limit(6)
    )
    deck_rows = database_connection_session.execute(decks_query).all()
    decks_out = []
    for dr in deck_rows:
        avg_m = float(dr.avg_m or 0.0)
        decks_out.append(
            {
                "id": int(dr.topic_unique_identifier),
                "name": dr.topic_display_name,
                "connections": int(dr.related_topics_count or 0),
                "isPublic": bool(dr.is_public_visibility),
                "mastery": int(round(max(0.0, min(100.0, avg_m)))),
            }
        )

    return {
        "user_name": authorized_student_user_account.user_full_display_name,
        "readiness_index_ri": readiness_index_ri_value,
        "readiness_index_view": readiness_index_view_value,
        "readiness_daily_delta": daily_delta,
        "due_today_count": due_today_count,
        "streak_days": streak_days,
        "accuracy_week_pct": accuracy_week_pct,
        "total_cards_studied": total_interactions,
        "mastery_avg_pct": mastery_avg_pct,
        "sigma_norm_pct": sigma_norm_pct,
        "hours_learning": hours_rounded,
        "weak_topic_name": weak_topic_name,
        "weak_topic_mastery_pct": weak_topic_mastery_pct,
        "zones": zones_out,
        "decks": decks_out,
    }


def _retrieve_or_initialize_user_energy_value_from_redis(
    authorized_student_user_account_identifier: int,
) -> tuple[float, object | None]:
    """Извлекает E из Redis или возвращает (100.0, None) при отсутствии."""
    try:
        import redis as redis_library
    except ModuleNotFoundError:
        return 100.0, None
    try:
        redis_url_value = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        redis_client_instance = redis_library.Redis.from_url(
            redis_url_value, decode_responses=True
        )
        session_energy_cache_key_string = (
            f"session:{authorized_student_user_account_identifier}:energy"
        )
        cached_energy_value_string = redis_client_instance.get(
            session_energy_cache_key_string
        )
        if cached_energy_value_string is None:
            return 100.0, redis_client_instance
        return float(cached_energy_value_string), redis_client_instance
    except Exception:
        return 100.0, None


def _persist_updated_user_energy_value_in_redis(
    authorized_student_user_account_identifier: int,
    updated_energy_value: float,
    redis_client_instance: object | None,
) -> float:
    """Сохраняет E в Redis с TTL 2 часа."""
    if redis_client_instance is None:
        return float(updated_energy_value)
    try:
        import redis as redis_library  # noqa: F401
    except ModuleNotFoundError:
        return float(updated_energy_value)
    session_energy_cache_key_string = (
        f"session:{authorized_student_user_account_identifier}:energy"
    )
    session_energy_ttl_seconds = 2 * 60 * 60
    redis_client_instance.set(
        session_energy_cache_key_string,
        str(updated_energy_value),
        ex=session_energy_ttl_seconds,
    )
    return float(updated_energy_value)


def _apply_energy_update_in_redis_or_initialize(
    database_session_instance: Session,
    authorized_student_user_account: UserAccountModel,
    response_thinking_time_ms: int,
    question_quality_q_value: float,
    submitted_answer_is_correct: bool,
) -> float:
    """
    Обновляет когнитивную энергию в Redis (или user_accounts при отсутствии Redis).

    Стоимость энергии зависит от динамической когнитивной нагрузки:
    τ (response_thinking_time_ms) и уверенности Q (question_quality_q_value).
    Затрагивает: Redis (ключ session:{user_id}:energy) или user_accounts.
    """
    current_energy_value, redis_client_instance = (
        _retrieve_or_initialize_user_energy_value_from_redis(
            authorized_student_user_account.user_unique_identifier
        )
    )
    remaining_user_cognitive_energy = update_energy(
        current_energy_value,
        response_thinking_time_ms=response_thinking_time_ms,
        user_subjective_confidence_score_q=question_quality_q_value,
        is_correct=submitted_answer_is_correct,
    )
    logger.info(
        "Когнитивная энергия обновлена: user=%s, E_old=%.2f, E_new=%.2f, "
        "tau_ms=%s, Q=%s, is_correct=%s",
        authorized_student_user_account.user_unique_identifier,
        current_energy_value,
        remaining_user_cognitive_energy,
        response_thinking_time_ms,
        question_quality_q_value,
        submitted_answer_is_correct,
    )
    if redis_client_instance is None:
        authorized_student_user_account.current_cognitive_energy_level = (
            remaining_user_cognitive_energy
        )
        database_session_instance.add(authorized_student_user_account)
        database_session_instance.commit()
        return float(remaining_user_cognitive_energy)
    return _persist_updated_user_energy_value_in_redis(
        authorized_student_user_account.user_unique_identifier,
        remaining_user_cognitive_energy,
        redis_client_instance,
    )


def _calculate_quality_q_value_from_is_correct_and_confidence(
    submitted_answer_is_correct: bool,
    submitted_user_subjective_confidence_score: float,
) -> int:
    """Считает Q (0–5) по is_correct и confidence (ТЗ)."""
    if not submitted_answer_is_correct:
        return 0
    if submitted_user_subjective_confidence_score >= 4.0:
        return 5
    if submitted_user_subjective_confidence_score >= 2.5:
        return 4
    return 3


def _map_confidence_score_to_user_subjective_confidence_level_enum(
    submitted_user_subjective_confidence_score: float,
) -> UserSubjectiveConfidenceLevelEnum:
    """Маппинг confidence (0–5) → Enum: легко/средне/тяжело."""
    if submitted_user_subjective_confidence_score >= 4.0:
        return UserSubjectiveConfidenceLevelEnum.easy
    if submitted_user_subjective_confidence_score >= 2.5:
        return UserSubjectiveConfidenceLevelEnum.medium
    return UserSubjectiveConfidenceLevelEnum.hard


def _fetch_user_card_progress_record(
    database_session_instance: Session,
    authorized_student_user_account_identifier: int,
    learning_card_identifier: int,
) -> UserCardProgressModel | None:
    """Ищет запись Progress (user-card) или возвращает None."""
    query_result = database_session_instance.execute(
        select(UserCardProgressModel).where(
            UserCardProgressModel.progress_owner_user_account_id
            == authorized_student_user_account_identifier,
            UserCardProgressModel.progress_target_card_unique_identifier
            == learning_card_identifier,
        )
    )
    return query_result.scalars().first()


def _fetch_or_initialize_user_progress_easiness_factor(
    database_session_instance: Session,
    authorized_student_user_account_identifier: int,
    learning_card_identifier: int,
    fallback_easiness_factor_value: float,
) -> float:
    """Возвращает EF из Progress или fallback из карточки."""
    progress_record = _fetch_user_card_progress_record(
        database_session_instance,
        authorized_student_user_account_identifier,
        learning_card_identifier,
    )
    if progress_record is None:
        return float(fallback_easiness_factor_value)
    return float(progress_record.progress_easiness_factor)


def _calculate_user_personal_forgetting_coefficient_lambda_i(
    database_session_instance: Session,
    authorized_student_user_account_identifier: int,
) -> float:
    """Считает λ_i по формуле 5 на базе Interactions пользователя."""
    interactions_query_result = database_session_instance.execute(
        select(LearningInteractionModel).where(
            LearningInteractionModel.interaction_owner_user_account_id
            == authorized_student_user_account_identifier,
        )
    )
    interactions_list = list(interactions_query_result.scalars().all())
    if not interactions_list:
        return 0.05
    correct_interactions_list = [
        record for record in interactions_list if record.interaction_is_correct
    ]
    accuracy_value = len(correct_interactions_list) / float(len(interactions_list))
    correct_response_time_ms_list = [
        float(record.interaction_response_time_ms)
        for record in correct_interactions_list
    ]
    if correct_response_time_ms_list:
        response_time_std_ms_value = statistics.pstdev(
            correct_response_time_ms_list
        )
    else:
        response_time_std_ms_value = 0.0
    return calculate_forgetting_rate(
        accuracy=accuracy_value,
        response_time_std_ms=response_time_std_ms_value,
    )


def _fetch_topic_mastery_average_value(
    database_session_instance: Session,
    authorized_student_user_account_identifier: int,
    topic_unique_identifier: int,
) -> float:
    """Средняя mastery_level по карточкам одной темы пользователя."""
    avg_query_result = database_session_instance.execute(
        select(func.avg(UserCardProgressModel.progress_mastery_level))
        .select_from(UserCardProgressModel)
        .join(
            LearningCardModel,
            UserCardProgressModel.progress_target_card_unique_identifier
            == LearningCardModel.card_unique_identifier,
        )
        .where(
            UserCardProgressModel.progress_owner_user_account_id
            == authorized_student_user_account_identifier,
            LearningCardModel.parent_topic_reference_id == topic_unique_identifier,
        )
    )
    avg_value = avg_query_result.scalar_one_or_none()
    if avg_value is None:
        return 0.0
    return float(avg_value)


def _create_interaction_and_update_progress_and_topic_mastery_average(
    database_session_instance: Session,
    authorized_student_user_account: UserAccountModel,
    updated_learning_card_instance: LearningCardModel,
    submitted_answer_is_correct: bool,
    submitted_user_subjective_confidence_score: float,
    time_spent_on_thinking_seconds: float,
    calculated_question_quality_q_value: int,
    calculated_new_easiness_factor: float,
    repetition_interval_days_count: int,
) -> tuple[datetime, int, float]:
    """
    Записывает user_interaction_history_log и обновляет UserCardProgress.

    Затрагиваемые таблицы:
    - interactions (запись): добавление лога ответа (response_time_ms, is_correct).
    - progress (запись): easiness_factor_ef, next_review_datetime, mastery_level.
    - learning_cards (запись): обновление card_easiness_factor, card_next_review_datetime.
    - user_accounts (запись): total_learning_hours.

    Возвращает: (next_review_datetime, topic_mastery_average_int, previous).
    """
    time_spent_on_thinking_seconds_value = float(time_spent_on_thinking_seconds)
    response_time_ms_value = int(time_spent_on_thinking_seconds_value * 1000.0)
    topic_unique_identifier = (
        updated_learning_card_instance.parent_topic_reference_id
    )
    previous_topic_mastery_average_value = _fetch_topic_mastery_average_value(
        database_session_instance,
        authorized_student_user_account.user_unique_identifier,
        topic_unique_identifier,
    )

    user_subjective_confidence_level_enum = (
        _map_confidence_score_to_user_subjective_confidence_level_enum(
            submitted_user_subjective_confidence_score
        )
    )
    interaction_record = LearningInteractionModel(
        interaction_owner_user_account_id=authorized_student_user_account.user_unique_identifier,
        interaction_target_card_unique_identifier=updated_learning_card_instance.card_unique_identifier,
        interaction_is_correct=submitted_answer_is_correct,
        interaction_response_time_ms=response_time_ms_value,
        interaction_subjective_confidence_level=user_subjective_confidence_level_enum,
    )
    database_session_instance.add(interaction_record)

    next_review_datetime_value = datetime.utcnow() + timedelta(
        days=int(repetition_interval_days_count)
    )

    existing_progress_record = _fetch_user_card_progress_record(
        database_session_instance,
        authorized_student_user_account.user_unique_identifier,
        updated_learning_card_instance.card_unique_identifier,
    )
    previous_card_mastery_level_value = (
        float(existing_progress_record.progress_mastery_level)
        if existing_progress_record is not None
        else 0.0
    )
    mastery_delta_value = (
        float(calculated_question_quality_q_value) * 2.0
        if submitted_answer_is_correct
        else -float(calculated_question_quality_q_value)
    )
    calculated_new_mastery_level_value = min(
        100.0,
        max(
            0.0,
            previous_card_mastery_level_value + mastery_delta_value,
        ),
    )

    previous_ef_value = (
        float(existing_progress_record.progress_easiness_factor)
        if existing_progress_record is not None
        else float(updated_learning_card_instance.card_easiness_factor_ef)
    )
    if existing_progress_record is None:
        existing_progress_record = UserCardProgressModel(
            progress_owner_user_account_id=authorized_student_user_account.user_unique_identifier,
            progress_target_card_unique_identifier=updated_learning_card_instance.card_unique_identifier,
        )
    existing_progress_record.progress_easiness_factor = float(
        calculated_new_easiness_factor
    )
    existing_progress_record.progress_interval_days = int(
        repetition_interval_days_count
    )
    logger.info(
        "Коэффициент лёгкости (easiness_factor_coefficient) обновлён: "
        "user=%s, card=%s, EF_old=%.3f, EF_new=%.3f",
        authorized_student_user_account.user_unique_identifier,
        updated_learning_card_instance.card_unique_identifier,
        previous_ef_value,
        calculated_new_easiness_factor,
    )
    existing_progress_record.progress_next_review_date = next_review_datetime_value
    existing_progress_record.progress_mastery_level = float(
        calculated_new_mastery_level_value
    )
    database_session_instance.add(existing_progress_record)

    updated_learning_card_instance.card_easiness_factor_ef = float(
        calculated_new_easiness_factor
    )
    updated_learning_card_instance.card_repetition_sequence_number += 1
    updated_learning_card_instance.card_last_interval_days = int(
        repetition_interval_days_count
    )
    updated_learning_card_instance.card_next_review_datetime = next_review_datetime_value
    database_session_instance.add(updated_learning_card_instance)

    authorized_student_user_account.total_learning_hours = float(
        authorized_student_user_account.total_learning_hours
        + time_spent_on_thinking_seconds_value / 3600.0
    )
    database_session_instance.add(authorized_student_user_account)
    database_session_instance.commit()

    updated_topic_mastery_average_value = _fetch_topic_mastery_average_value(
        database_session_instance,
        authorized_student_user_account.user_unique_identifier,
        topic_unique_identifier,
    )
    updated_topic_mastery_average_int = int(
        round(updated_topic_mastery_average_value)
    )
    return (
        next_review_datetime_value,
        updated_topic_mastery_average_int,
        previous_topic_mastery_average_value,
    )


def _calculate_eta_and_ri_background_task(
    authorized_student_user_account_identifier: int,
    initial_mastery: float,
    final_mastery: float,
    session_duration_hours: float,
) -> None:
    """
    Фоновая задача: вызывает refresh_user_global_stats для агрегации
    из interactions и progress в user_accounts (total_learning_hours,
    last_calculated_readiness_index_ri).
    """
    database_session_background = next(get_database_session_generator())
    try:
        calculated_session_efficiency_coefficient = calculate_learning_efficiency(
            initial_mastery=initial_mastery,
            final_mastery=final_mastery,
            session_duration_hours=session_duration_hours,
            unique_topics_count=1,
        )
        logger.info(
            "Расчёт эффективности сессии: user=%s, η=%.4f",
            authorized_student_user_account_identifier,
            calculated_session_efficiency_coefficient,
        )
        refresh_user_global_stats(
            database_session_instance=database_session_background,
            target_user_account_identifier=authorized_student_user_account_identifier,
        )
    finally:
        database_session_background.close()
