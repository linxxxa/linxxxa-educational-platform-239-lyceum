"""
Обработка ответов ученика: энергия E, SM-2, RI (τ).
Энтропия H(T) масштабирует затраты: сложные темы отнимают больше энергии.
"""
from datetime import datetime, timedelta, timezone

BASE_ENERGY_COST = 5.0
MINIMUM_EASINESS_FACTOR = 1.3


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
    Обрабатывает ответ: энергия E, SM-2, RI (τ).
    Энтропия H(T) масштабирует затраты энергии.
    """
    topic_entropy = (
        card_object.parent_topic.topic_entropy_complexity_value
        if card_object.parent_topic
        else 0.0
    )
    user_object.current_cognitive_energy_level = _apply_cognitive_energy_consumption(
        user_object.current_cognitive_energy_level, topic_entropy
    )
    new_ef, interval_days = _calculate_sm2_parameters(card_object, confidence_score_q)
    card_object.card_easiness_factor_ef = new_ef
    card_object.card_repetition_sequence_number += 1
    card_object.card_last_interval_days = interval_days
    card_object.card_next_review_datetime = datetime.now(timezone.utc) + timedelta(
        days=interval_days
    )
    user_object.average_response_time_seconds = _update_tau_sliding_average(
        user_object.average_response_time_seconds, thinking_time_tau
    )
    database_session_instance.commit()
    database_session_instance.refresh(user_object)
    database_session_instance.refresh(card_object)
    return {
        "remaining_cognitive_energy": user_object.current_cognitive_energy_level,
        "next_review_days": interval_days,
        "new_easiness_factor": new_ef,
    }
