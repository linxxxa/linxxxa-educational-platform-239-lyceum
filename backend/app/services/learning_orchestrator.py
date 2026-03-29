"""
Оркестратор обучения: связывает БД, Redis и MathEngine.

Задача: при ответе пользователя последовательно обновить энергию, математику
SM-2 и состояние расписания (Progress) + лог (Interactions).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from math import sqrt
from typing import Any

from sqlalchemy import case, cast, Float, func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_database_session_generator
from app.models.learning_card import LearningCardModel
from app.models.learning_interaction import (
    LearningInteractionsModel,
    UserSubjectiveConfidenceLevelEnum,
)
from app.models.learning_topic import LearningTopicModel
from app.models.user_account import UserAccountModel
from app.models.user_card_progress import UserCardProgressModel
from app.services.math_engine import (
    calculate_forgetting_rate,
    run_sm2_step,
    update_energy,
)


logger = logging.getLogger(__name__)


class SessionEnergyDepleted(Exception):
    """Энергия пользователя достигла нуля и сессия должна завершиться."""


def _get_response_time_ms_from_answer_data(answer_data: dict) -> int:
    """
    Извлекает response_time_ms из answer_data.
    Поддерживает и секунды (response_thinking_time_seconds) для совместимости.
    """
    if "response_time_ms" in answer_data:
        return int(answer_data["response_time_ms"])
    if "response_thinking_time_seconds" in answer_data:
        return int(float(answer_data["response_thinking_time_seconds"]) * 1000.0)
    if "response_thinking_time_ms" in answer_data:
        return int(answer_data["response_thinking_time_ms"])
    return 0


def _calculate_quality_q_value_from_answer_data(
    answer_data: dict,
) -> int:
    """Переводит (is_correct, user_confidence) в Q (0–5) по ТЗ."""
    is_answer_correct = bool(answer_data.get("is_correct", False))
    submitted_user_subjective_confidence_score = float(
        answer_data.get("user_confidence", 0.0)
    )
    if not is_answer_correct:
        return 0
    if submitted_user_subjective_confidence_score >= 4.0:
        return 5
    if submitted_user_subjective_confidence_score >= 2.5:
        return 4
    return 3


def _map_confidence_score_to_user_subjective_confidence_level_enum(
    submitted_user_subjective_confidence_score: float,
) -> UserSubjectiveConfidenceLevelEnum:
    """Маппит уверенность 0–5 в Enum: легко/средне/тяжело."""
    if submitted_user_subjective_confidence_score >= 4.0:
        return UserSubjectiveConfidenceLevelEnum.easy
    if submitted_user_subjective_confidence_score >= 2.5:
        return UserSubjectiveConfidenceLevelEnum.medium
    return UserSubjectiveConfidenceLevelEnum.hard


def _calculate_topic_entropy_value_from_card(
    learning_card_instance: LearningCardModel,
) -> float:
    """Получает H(T) из связанной темы карточки."""
    topic_instance: LearningTopicModel | None = (
        learning_card_instance.parent_topic
    )
    if topic_instance is None:
        return 0.0
    if getattr(topic_instance, "topic_entropy_value", None) is not None:
        return float(topic_instance.topic_entropy_value)
    return float(topic_instance.topic_entropy_complexity_value)


def _retrieve_user_energy_from_redis_or_database(
    user_unique_identifier: int,
    database_session_instance: Session,
) -> float:
    """
    Пытается получить E из Redis.
    Если библиотека redis недоступна — берём последнее сохранённое поле из БД.
    """
    try:
        import redis  # type: ignore
    except ModuleNotFoundError:
        user_energy_value = (
            database_session_instance.execute(
                select(UserAccountModel).where(
                    UserAccountModel.user_unique_identifier == user_unique_identifier
                )
            )
            .scalars()
            .first()
        )
        return float(user_energy_value.current_cognitive_energy_level)

    redis_url_value = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_client_instance = redis.Redis.from_url(
        redis_url_value, decode_responses=True
    )
    cache_key_string = f"session:{user_unique_identifier}:energy"
    cached_energy_value_string = redis_client_instance.get(cache_key_string)
    if cached_energy_value_string is None:
        return 100.0
    return float(cached_energy_value_string)


def _persist_user_energy_to_redis_or_database(
    user_unique_identifier: int,
    updated_cognitive_energy_level: float,
    database_session_instance: Session,
) -> None:
    """Сохраняет E обратно в Redis (TTL 2 часа) или в БД."""
    try:
        import redis  # type: ignore
    except ModuleNotFoundError:
        user_record = (
            database_session_instance.execute(
                select(UserAccountModel).where(
                    UserAccountModel.user_unique_identifier
                    == user_unique_identifier
                )
            )
            .scalars()
            .first()
        )
        if user_record is not None:
            user_record.current_cognitive_energy_level = (
                updated_cognitive_energy_level
            )
            database_session_instance.add(user_record)
            database_session_instance.commit()
        return

    redis_url_value = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_client_instance = redis.Redis.from_url(
        redis_url_value, decode_responses=True
    )
    cache_key_string = f"session:{user_unique_identifier}:energy"
    redis_client_instance.set(
        cache_key_string,
        str(updated_cognitive_energy_level),
        ex=2 * 60 * 60,
    )


def _calculate_user_personal_forgetting_coefficient_lambda_i(
    database_session_instance: Session,
    user_unique_identifier: int,
) -> float:
    """
    λ_i рассчитывается агрегированием по Interactions:
    A_i = correct_count / total_count,
    σ_t — стандартное отклонение времени на правильных ответах.
    """
    correct_count_query = func.sum(
        case(
            (LearningInteractionsModel.interaction_is_correct.is_(True), 1),
            else_=0,
        )
    )
    total_count_query = func.count(
        LearningInteractionsModel.interaction_unique_identifier
    )

    correct_time_query = func.avg(
        case(
            (
                LearningInteractionsModel.interaction_is_correct.is_(True),
                cast(LearningInteractionsModel.interaction_response_time_ms, Float),
            ),
            else_=None,
        )
    )
    correct_square_time_query = func.avg(
        case(
            (
                LearningInteractionsModel.interaction_is_correct.is_(True),
                cast(
                    LearningInteractionsModel.interaction_response_time_ms
                    * LearningInteractionsModel.interaction_response_time_ms,
                    Float,
                ),
            ),
            else_=None,
        )
    )

    aggregation_query_result = database_session_instance.execute(
        select(
            total_count_query.label("total_count"),
            correct_count_query.label("correct_count"),
            correct_time_query.label("mean_time"),
            correct_square_time_query.label("mean_square_time"),
        ).where(
            LearningInteractionsModel.interaction_owner_user_account_id
            == user_unique_identifier
        )
    ).one()

    total_count_value = int(aggregation_query_result.total_count or 0)
    correct_count_value = int(aggregation_query_result.correct_count or 0)
    accumulated_accuracy_rate = (
        correct_count_value / float(total_count_value)
        if total_count_value > 0
        else 0.0
    )

    mean_time_value = float(aggregation_query_result.mean_time or 0.0)
    mean_square_time_value = float(
        aggregation_query_result.mean_square_time or 0.0
    )
    variance_value = max(0.0, mean_square_time_value - mean_time_value**2)
    response_time_std_ms_value = sqrt(variance_value)
    return calculate_forgetting_rate(
        accuracy=accumulated_accuracy_rate,
        response_time_std_ms=response_time_std_ms_value,
    )


def _calculate_modified_next_review_datetime(
    calculated_next_review_timestamp_base: datetime,
    modified_repetition_interval: int,
) -> datetime:
    """Складывает base-time и interval дней."""
    return calculated_next_review_timestamp_base + timedelta(
        days=int(modified_repetition_interval)
    )


def handle_card_answer(
    user_id: int,
    card_id: int,
    answer_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Финальная обработка ответа пользователя:
    1) Redis: извлечь E и обновить через update_energy.
    2) H(T) и λ_i → run_sm2_step.
    3) Interactions + Progress обновляются в БД.

    Возвращает структуру состояния для UI.
    """
    database_session_instance = next(get_database_session_generator())
    try:
        learning_card_instance = database_session_instance.execute(
            select(LearningCardModel)
            .options(joinedload(LearningCardModel.parent_topic))
            .where(
                LearningCardModel.card_unique_identifier == card_id,
                LearningCardModel.owner_user_account_id == user_id,
            )
        ).scalars().first()
        if learning_card_instance is None:
            raise ValueError("Карточка не найдена или доступ запрещён")

        current_energy_value = _retrieve_user_energy_from_redis_or_database(
            user_unique_identifier=user_id,
            database_session_instance=database_session_instance,
        )

        is_correct_value = bool(answer_data.get("is_correct", False))
        response_time_ms_value = _get_response_time_ms_from_answer_data(
            answer_data
        )
        submitted_user_subjective_confidence_score = float(
            answer_data.get("user_confidence", 0.0)
        )
        calculated_quality_q_value = (
            _calculate_quality_q_value_from_answer_data(answer_data)
        )

        updated_cognitive_energy_level = update_energy(
            current_energy=current_energy_value,
            response_thinking_time_ms=response_time_ms_value,
            user_subjective_confidence_score_q=submitted_user_subjective_confidence_score,
            is_correct=is_correct_value,
        )
        logger.info(
            "Energy update: user_id=%s card_id=%s old_E=%s new_E=%s",
            user_id,
            card_id,
            current_energy_value,
            updated_cognitive_energy_level,
        )
        _persist_user_energy_to_redis_or_database(
            user_unique_identifier=user_id,
            updated_cognitive_energy_level=updated_cognitive_energy_level,
            database_session_instance=database_session_instance,
        )

        if updated_cognitive_energy_level <= 0.0:
            raise SessionEnergyDepleted()

        # submitted_user_subjective_confidence_score уже вычислен выше

        calculated_topic_entropy_value = _calculate_topic_entropy_value_from_card(
            learning_card_instance
        )
        user_personal_forgetting_coefficient_value = (
            _calculate_user_personal_forgetting_coefficient_lambda_i(
                database_session_instance,
                user_unique_identifier=user_id,
            )
        )
        (
            calculated_new_easiness_factor,
            modified_repetition_interval,
            _fast_track_week,
        ) = run_sm2_step(
            confidence_score_q=calculated_quality_q_value,
            previous_easiness_factor_ef=float(
                learning_card_instance.card_easiness_factor_ef
            ),
            repetition_sequence_number=int(
                learning_card_instance.card_repetition_sequence_number
            ),
            previous_interval_days_count=int(
                learning_card_instance.card_last_interval_days
            ),
            calculated_topic_entropy_value=calculated_topic_entropy_value,
            user_personal_forgetting_coefficient=user_personal_forgetting_coefficient_value,
            response_thinking_time_ms=response_time_ms_value,
            previous_success_quality_q=None,
        )
        logger.info(
            "SM2 update: user_id=%s card_id=%s new_EF=%s interval_days=%s H(T)=%s lambda_i=%s",
            user_id,
            card_id,
            calculated_new_easiness_factor,
            modified_repetition_interval,
            calculated_topic_entropy_value,
            user_personal_forgetting_coefficient_value,
        )

        user_subjective_confidence_level_enum = (
            _map_confidence_score_to_user_subjective_confidence_level_enum(
                submitted_user_subjective_confidence_score
            )
        )

        database_session_instance.add(
            LearningInteractionsModel(
                interaction_owner_user_account_id=user_id,
                interaction_target_card_unique_identifier=card_id,
                interaction_is_correct=bool(
                    answer_data.get("is_correct", False)
                ),
                interaction_response_time_ms=response_time_ms_value,
                interaction_subjective_confidence_level=(
                    user_subjective_confidence_level_enum
                ),
                interaction_timestamp=datetime.now(timezone.utc),
            )
        )

        progress_record = database_session_instance.execute(
            select(UserCardProgressModel).where(
                UserCardProgressModel.progress_owner_user_account_id == user_id,
                UserCardProgressModel.progress_target_card_unique_identifier
                == card_id,
            )
        ).scalars().first()

        calculated_next_review_timestamp = datetime.now(timezone.utc)
        calculated_next_review_timestamp = (
            _calculate_modified_next_review_datetime(
                calculated_next_review_timestamp,
                modified_repetition_interval,
            )
        )

        previous_mastery_level_value = (
            float(progress_record.progress_mastery_level)
            if progress_record is not None
            else 0.0
        )
        if bool(answer_data.get("is_correct", False)):
            updated_card_mastery_level_value = min(
                100.0, previous_mastery_level_value + calculated_quality_q_value * 2.0
            )
        else:
            updated_card_mastery_level_value = max(
                0.0, previous_mastery_level_value - calculated_quality_q_value
            )

        if progress_record is None:
            progress_record = UserCardProgressModel(
                progress_owner_user_account_id=user_id,
                progress_target_card_unique_identifier=card_id,
            )

        progress_record.progress_easiness_factor = float(
            calculated_new_easiness_factor
        )
        progress_record.progress_interval_days = int(modified_repetition_interval)
        progress_record.progress_next_review_date = (
            calculated_next_review_timestamp
        )
        progress_record.progress_mastery_level = float(
            updated_card_mastery_level_value
        )

        learning_card_instance.card_easiness_factor_ef = float(
            calculated_new_easiness_factor
        )
        learning_card_instance.card_repetition_sequence_number += 1
        learning_card_instance.card_last_interval_days = int(
            modified_repetition_interval
        )
        learning_card_instance.card_next_review_datetime = (
            calculated_next_review_timestamp
        )
        database_session_instance.add(progress_record)
        database_session_instance.add(learning_card_instance)
        database_session_instance.commit()

        return {
            "is_correct": bool(answer_data.get("is_correct", False)),
            "updated_cognitive_energy_level": float(
                updated_cognitive_energy_level
            ),
            "calculated_next_review_timestamp": calculated_next_review_timestamp,
            "updated_card_mastery_level_int": int(
                round(updated_card_mastery_level_value)
            ),
        }
    finally:
        database_session_instance.close()

