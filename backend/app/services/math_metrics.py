"""
Метрики качества обучения (η эффективность и RI Индекс готовности).

Модуль содержит только чистые вычисления (без обращения к БД и Redis).
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Sequence


def theme_mastery_weighted_percent(
    last_quality_q_per_card: Sequence[int | None],
) -> float:
    """
    Уровень освоения темы (колоды) 0–100% по весам карточек.

    W = 100 / N. Для каждой карточки вклад W * (Q/5), если последний Q > 2,
    иначе вклад 0. Q — дискретное 0–5 (SM-2 / субъективная оценка ответа).
    """
    n = len(last_quality_q_per_card)
    if n <= 0:
        return 0.0
    weight = 100.0 / float(n)
    total = 0.0
    for q in last_quality_q_per_card:
        if q is None:
            continue
        qi = int(q)
        if qi <= 2:
            continue
        total += weight * (min(5, max(0, qi)) / 5.0)
    return max(0.0, min(100.0, total))


def learning_efficiency_percent_from_q_totals(
    sum_quality_q: float, num_answers: int
) -> float:
    """
    Устаревшая агрегатная формула (ΣQ)/(N·5)·100 — оставлена для совместимости.
    """
    if num_answers <= 0:
        return 0.0
    return max(
        0.0,
        min(
            100.0,
            (float(sum_quality_q) / (float(num_answers) * 5.0)) * 100.0,
        ),
    )


def interaction_efficiency_percent(
    is_correct: bool, q_discrete_when_correct: int
) -> float:
    """
    Эффективность одного ответа:
    (Base_Accuracy × 0.7) + (Q_bonus × 0.3).
    Base_Accuracy: 100 % при верном, 0 % при ошибке.
    Q_bonus: нормализованная Q (5 → 100 %, 3 → 60 %). При ошибке бонус как при Q=1 (20 %).
    """
    base_acc = 100.0 if is_correct else 0.0
    if is_correct:
        q_bonus = (
            max(0, min(5, int(q_discrete_when_correct))) / 5.0
        ) * 100.0
    else:
        q_bonus = 20.0
    return max(0.0, min(100.0, 0.7 * base_acc + 0.3 * q_bonus))


def calculate_learning_efficiency(
    initial_mastery: float,
    final_mastery: float,
    session_duration_hours: float,
    unique_topics_count: int,
) -> float:
    """
    Рассчитывает эффективность обучения η (формула 4 ТЗ).

    η = (ΔM * log2(K + 1)) / ((M₀ + 0.1) * t_hours)
    где:
    - ΔM = final_mastery - initial_mastery,
    - K = unique_topics_count,
    - t_hours = session_duration_hours.
    """
    if session_duration_hours <= 0:
        return 0.0
    topics_count_value = max(0, unique_topics_count)
    delta_mastery_value = final_mastery - initial_mastery
    numerator_value = delta_mastery_value * math.log2(topics_count_value + 1.0)
    denominator_value = (initial_mastery + 0.1) * session_duration_hours
    if denominator_value <= 0:
        return 0.0
    calculated_eta_value = numerator_value / denominator_value
    return max(0.0, calculated_eta_value)


def calculate_readiness_index(
    mastery_levels: list[float],
    total_hours: float,
) -> float:
    """
    Индекс готовности RI (смягчённо для ранних этапов).

    RI = w_M * M_norm + w_σ * σ_norm + w_τ * τ_norm, сумма весов = 1000.
    Выше вес практики по времени; σ мягче (÷30); небольшой подъём M при ≤10 темах.
    """
    w_m_value = 620.0
    w_sigma_value = 170.0
    w_tau_value = 210.0

    if not mastery_levels:
        return 0.0

    mastery_mean_value = sum(mastery_levels) / float(len(mastery_levels))
    mastery_std_value = (
        statistics.pstdev(mastery_levels) if len(mastery_levels) > 1 else 0.0
    )

    m_norm_value = max(0.0, mastery_mean_value / 100.0)
    topic_count = len(mastery_levels)
    if topic_count <= 10:
        participation_lift = min(0.14, 0.012 * float(topic_count))
        m_norm_value = min(1.0, m_norm_value + participation_lift)
    m_norm_value = max(m_norm_value, 0.07)

    sigma_norm_value = max(0.0, 1.0 - mastery_std_value / 30.0)
    total_hours_value = max(0.0, total_hours)
    tau_norm_value = math.log10(total_hours_value + 1.0) / 3.0

    calculated_ri_value = (
        w_m_value * m_norm_value
        + w_sigma_value * sigma_norm_value
        + w_tau_value * tau_norm_value
    )
    return max(0.0, min(1000.0, calculated_ri_value))