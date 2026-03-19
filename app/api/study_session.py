"""
Эндпоинты сессий обучения: ответы на карточки, SM-2.
"""
from __future__ import annotations

import os
import statistics
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.api.dependencies import get_current_authorized_user_object
from app.database import get_database_session_generator
from app.models.learning_card import LearningCardModel
from app.models.learning_interaction import (
    LearningInteractionModel,
    UserSubjectiveConfidenceLevelEnum,
)
from app.models.user_account import UserAccountModel
from app.models.user_card_progress import UserCardProgressModel
from app.schemas.study import UserAnswerSubmission
from app.services.math_engine import (
    calculate_forgetting_rate,
    run_sm2_step,
    update_energy,
)
from app.services.math_metrics import (
    calculate_learning_efficiency,
    calculate_readiness_index,
)


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

    remaining_user_cognitive_energy = (
        _apply_energy_update_in_redis_or_initialize(
            database_session_instance=database_connection_session,
            authorized_student_user_account=authorized_student_user_account,
            learning_card_difficulty_level=updated_learning_card_instance.difficulty_level,
            submitted_answer_is_correct=submitted_answer_data_transfer_object.submitted_user_answer_is_correct,
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
        return {
            "session_completed": True,
            "is_correct": submitted_answer_data_transfer_object.submitted_user_answer_is_correct,
            "energy_left": remaining_user_cognitive_energy,
            "next_review": next_review_date_value,
            "new_mastery": new_mastery_value,
        }

    calculated_question_quality_q_value = _calculate_quality_q_value_from_is_correct_and_confidence(
        submitted_answer_is_correct=submitted_answer_data_transfer_object.submitted_user_answer_is_correct,
        submitted_user_subjective_confidence_score=submitted_answer_data_transfer_object.user_subjective_confidence_score,
    )
    user_personal_forgetting_coefficient = _calculate_user_personal_forgetting_coefficient_lambda_i(
        database_session_instance=database_connection_session,
        authorized_student_user_account_identifier=authorized_student_user_account.user_unique_identifier,
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
        calculated_topic_entropy_value=updated_learning_card_instance.parent_topic.topic_entropy_complexity_value,
        user_personal_forgetting_coefficient=user_personal_forgetting_coefficient,
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

    return {
        "is_correct": submitted_answer_data_transfer_object.submitted_user_answer_is_correct,
        "energy_left": remaining_user_cognitive_energy,
        "next_review": updated_next_review_datetime.date(),
        "new_mastery": updated_topic_mastery_average_int,
    }


def _retrieve_or_initialize_user_energy_value_from_redis(
    authorized_student_user_account_identifier: int,
) -> tuple[float, object | None]:
    """Извлекает E из Redis или возвращает (100.0, None) при отсутствии."""
    try:
        import redis as redis_library
    except ModuleNotFoundError:
        return 100.0, None
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
    learning_card_difficulty_level: int,
    submitted_answer_is_correct: bool,
) -> float:
    """
    Шаг Redis: E → update_energy → persist.
    Энтропия/SM-2 на этом шаге не участвуют — только стоимость ответа.
    """
    current_energy_value, redis_client_instance = (
        _retrieve_or_initialize_user_energy_value_from_redis(
            authorized_student_user_account.user_unique_identifier
        )
    )
    remaining_user_cognitive_energy = update_energy(
        current_energy_value,
        learning_card_difficulty_level,
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
    Записывает Interactions, обновляет Progress и пересчитывает mastery темы.
    Возвращает: (next_review_datetime, topic_mastery_average_int, topic_mastery_average_float_before).
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
    """Фоновая задача: считает η и RI и обновляет агрегаты пользователя."""
    database_session_background = next(get_database_session_generator())
    try:
        mastery_levels_query_result = (
            database_session_background.execute(
                select(
                    func.avg(UserCardProgressModel.progress_mastery_level)
                )
                .select_from(UserCardProgressModel)
                .join(
                    LearningCardModel,
                    UserCardProgressModel.progress_target_card_unique_identifier
                    == LearningCardModel.card_unique_identifier,
                )
                .group_by(LearningCardModel.parent_topic_reference_id)
                .where(
                    UserCardProgressModel.progress_owner_user_account_id
                    == authorized_student_user_account_identifier
                )
            )
        )
        mastery_levels_list = [
            float(v)
            for v in mastery_levels_query_result.scalars().all()
            if v is not None
        ]

        total_response_time_ms_query_result = (
            database_session_background.execute(
                select(
                    func.sum(LearningInteractionModel.interaction_response_time_ms)
                ).where(
                    LearningInteractionModel.interaction_owner_user_account_id
                    == authorized_student_user_account_identifier
                )
            )
        )
        total_response_time_ms_value = (
            total_response_time_ms_query_result.scalar_one_or_none() or 0
        )
        total_hours_value = float(total_response_time_ms_value) / 3600000.0

        calculated_readiness_index_value = calculate_readiness_index(
            mastery_levels=mastery_levels_list,
            total_hours=total_hours_value,
        )
        calculated_learning_efficiency_value = calculate_learning_efficiency(
            initial_mastery=initial_mastery,
            final_mastery=final_mastery,
            session_duration_hours=session_duration_hours,
            unique_topics_count=1,
        )

        user_record = (
            database_session_background.execute(
                select(UserAccountModel).where(
                    UserAccountModel.user_unique_identifier
                    == authorized_student_user_account_identifier
                )
            )
            .scalars()
            .first()
        )
        if user_record is not None:
            user_record.global_mastery_coefficient = (
                sum(mastery_levels_list) / float(len(mastery_levels_list))
                if mastery_levels_list
                else 0.0
            )
            user_record.knowledge_deviation_sigma = (
                statistics.pstdev(mastery_levels_list)
                if len(mastery_levels_list) > 1
                else 0.0
            )
            database_session_background.add(user_record)
            database_session_background.commit()
    finally:
        database_session_background.close()
