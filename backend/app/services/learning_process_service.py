"""
Обработка ответов ученика: энергия E и интервалы повторения.

По 239-протоколу карточная "статическая сложность" больше не используется.
Сложность теперь динамически считывается из времени ответа и уверенности.
"""
from datetime import datetime, timedelta, timezone

MINIMUM_EASINESS_FACTOR = 1.3
BASE_ENERGY_COST = 5.0


def _apply_cognitive_energy_consumption(
    current_cognitive_energy_level: float,
    topic_entropy_complexity_value_h_t: float,
) -> float:
    """
    E_new = E_current - (BASE_COST * H_T).
    Энтропия H(T) масштабирует затраты: чем сложнее тема, тем больше energy cost.
    """
    remaining_user_cognitive_energy = (
        current_cognitive_energy_level
        - BASE_ENERGY_COST * topic_entropy_complexity_value_h_t
    )
    return max(0.0, remaining_user_cognitive_energy)


def _calculate_sm2_easiness_factor(
    old_easiness_factor: float,
    user_subjective_confidence_score_q: float,
) -> float:
    """
    SM-2: EF_new = EF_old + (0.1 - (5 - Q) * (0.08 + (5 - Q) * 0.02)).
    Ограничение: EF >= 1.3.
    """
    q_term = 5.0 - user_subjective_confidence_score_q
    delta = 0.1 - q_term * (0.08 + q_term * 0.02)
    calculated_new_easiness_factor = old_easiness_factor + delta
    return max(MINIMUM_EASINESS_FACTOR, calculated_new_easiness_factor)


def _calculate_repetition_interval_days(
    repetition_sequence_n: int,
    old_interval_days: int,
    new_easiness_factor: float,
) -> int:
    """
    n=0 → 1 день; n=1 → 6 дней; n>1 → I_old * EF_new.
    n — число успешных повторений после текущего ответа.
    """
    if repetition_sequence_n == 1:
        return 1
    if repetition_sequence_n == 2:
        return 6
    repetition_interval_days_count = old_interval_days * new_easiness_factor
    return round(repetition_interval_days_count)


def _update_tau_sliding_average(
    tau_old: float,
    time_spent_on_thinking_seconds: float,
) -> float:
    """τ_new = τ_old * 0.8 + current_thinking_time * 0.2."""
    return tau_old * 0.8 + time_spent_on_thinking_seconds * 0.2


def _calculate_sm2_parameters(
    card_object,
    confidence_score_q: float,
) -> tuple[float, int]:
    """Вычисляет новый EF и интервал повторения. Возвращает (ef_new, interval_days)."""
    new_ef = _calculate_sm2_easiness_factor(
        card_object.card_easiness_factor_ef, confidence_score_q
    )
    new_n = card_object.card_repetition_sequence_number + 1
    interval_days = _calculate_repetition_interval_days(
        new_n, card_object.card_last_interval_days, new_ef
    )
    return new_ef, interval_days


def process_user_answer_impact(
    database_session_instance,
    user_object,
    card_object,
    confidence_score_q: float,
    thinking_time_tau: float,
) -> dict:
    """
    Обрабатывает ответ: энергия E и интервал повторения.

    По 239-протоколу:
    - энергия списывается динамической стоимостью (время ответа τ + уверенность Q)
    - интервал сжимается энтропией темы H(T), взятой из learning_topics (JOIN)
    """
    from app.models.learning_topic import LearningTopicModel
    from app.services.math_engine import run_sm2_step, update_energy

    thinking_time_tau_ms = float(thinking_time_tau)

    topic_entropy_value = 0.0
    # JOIN/загрузка темы для H(T)
    if getattr(card_object, "parent_topic_reference_id", None) is not None:
        topic_obj = database_session_instance.get(
            LearningTopicModel,
            int(card_object.parent_topic_reference_id),
        )
        if topic_obj is not None:
            topic_entropy_value = float(
                getattr(
                    topic_obj,
                    "topic_entropy_value",
                    getattr(topic_obj, "topic_entropy_complexity_value", 0.0),
                )
            )

    is_correct_value = bool(confidence_score_q > 0)

    user_object.current_cognitive_energy_level = update_energy(
        current_energy=float(user_object.current_cognitive_energy_level),
        response_thinking_time_ms=thinking_time_tau_ms,
        user_subjective_confidence_score_q=float(confidence_score_q),
        is_correct=is_correct_value,
    )

    user_personal_forgetting_coefficient = float(
        getattr(
            user_object,
            "personal_forgetting_lambda",
            getattr(user_object, "personal_lambda", 0.05),
        )
    )

    new_ef, interval_days = run_sm2_step(
        confidence_score_q=int(confidence_score_q),
        previous_easiness_factor_ef=float(
            getattr(card_object, "card_easiness_factor_ef", 2.5)
        ),
        repetition_sequence_number=int(
            getattr(card_object, "card_repetition_sequence_number", 0)
        ),
        previous_interval_days_count=int(
            getattr(card_object, "card_last_interval_days", 0)
        ),
        calculated_topic_entropy_value=topic_entropy_value,
        user_personal_forgetting_coefficient=user_personal_forgetting_coefficient,
        response_thinking_time_ms=thinking_time_tau_ms,
    )

    card_object.card_easiness_factor_ef = max(
        MINIMUM_EASINESS_FACTOR, float(new_ef)
    )
    card_object.card_repetition_sequence_number += 1
    card_object.card_last_interval_days = int(interval_days)
    card_object.card_next_review_datetime = datetime.now(timezone.utc) + timedelta(
        days=interval_days
    )
    user_object.average_response_time_seconds = _update_tau_sliding_average(
        user_object.average_response_time_seconds,
        thinking_time_tau / 1000.0,
    )
    database_session_instance.commit()
    database_session_instance.refresh(user_object)
    database_session_instance.refresh(card_object)
    return {
        "remaining_cognitive_energy": user_object.current_cognitive_energy_level,
        "next_review_days": interval_days,
        "new_easiness_factor": new_ef,
    }
