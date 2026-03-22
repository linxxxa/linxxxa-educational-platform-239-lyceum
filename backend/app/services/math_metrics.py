"""
Метрики качества обучения (η эффективность и RI Индекс готовности).

Модуль содержит только чистые вычисления (без обращения к БД и Redis).
"""

from __future__ import annotations

import math
import statistics


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
    Рассчитывает Индекс Готовности RI (формула 3 ТЗ).

    RI = w_M * M_norm + w_σ * σ_norm + w_τ * τ_norm, где сумма весов = 1000.
    """
    w_m_value = 700.0
    w_sigma_value = 200.0
    w_tau_value = 100.0

    if not mastery_levels:
        return 0.0

    mastery_mean_value = sum(mastery_levels) / float(len(mastery_levels))
    mastery_std_value = statistics.pstdev(mastery_levels)

    m_norm_value = max(0.0, mastery_mean_value / 100.0)
    sigma_norm_value = max(0.0, 1.0 - mastery_std_value / 25.0)
    total_hours_value = max(0.0, total_hours)
    tau_norm_value = math.log10(total_hours_value + 1.0) / 3.0

    calculated_ri_value = (
        w_m_value * m_norm_value
        + w_sigma_value * sigma_norm_value
        + w_tau_value * tau_norm_value
    )
    return max(0.0, min(1000.0, calculated_ri_value))