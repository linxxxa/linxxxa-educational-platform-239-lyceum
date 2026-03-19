"""
Математический движок проекта (чистые функции).

Здесь собрана вся вычислительная логика: энтропия темы, энергия, персональное
забывание и шаг модифицированного SM-2. Модуль не обращается к БД и Redis.
"""

from __future__ import annotations

import math


def calculate_topic_entropy(
    error_rates: list[float],
    connections_count: int,
    alpha: float = 0.1,
) -> float:
    """
    Рассчитывает сложность темы H(T).

    Формула:
      H(T) = -Σ(p_i * log2(p_i)) + α * C

    Обработка граничных случаев:
    - Если по теме нет ответов, то p_i принимается равным 0.5.
    - Если p_i == 0 или p_i == 1, то слагаемое p_i * log2(p_i) считается равным 0.
    """
    probabilities_list = error_rates if error_rates else [0.5]
    entropy_sum_part = 0.0
    for probability_p_i in probabilities_list:
        if probability_p_i <= 0.0 or probability_p_i >= 1.0:
            continue
        entropy_sum_part += probability_p_i * math.log2(probability_p_i)
    calculated_topic_entropy_value = (
        -entropy_sum_part + alpha * connections_count
    )
    return max(0.0, calculated_topic_entropy_value)


def update_energy(
    current_energy: float,
    difficulty: int,
    is_correct: bool,
) -> float:
    """
    Обновляет когнитивную энергию пользователя E после ответа карточки.

    Формула:
      Cost = difficulty (если ответ верный) или difficulty * 1.5
             (если неверный)
      E_new = E_old - Cost
    """
    cost_value = difficulty if is_correct else difficulty * 1.5
    new_energy_value = current_energy - cost_value
    return max(0.0, new_energy_value)


def calculate_forgetting_rate(
    accuracy: float,
    response_time_std_ms: float,
) -> float:
    """
    Рассчитывает персональный коэффициент забывания λ_i.

    Формула:
      λ_i = 0.05 + 0.3 * (1 - A_i) - 0.1 * (1 - min(1, σ_t / 5000))

    Возвращает λ_i >= 0 (неотрицательный результат).
    """
    lambda0_value = 0.05
    gamma_value = 0.3
    delta_value = 0.1

    accuracy_value = max(0.0, min(1.0, accuracy))
    sigma_t_norm_value = min(1.0, response_time_std_ms / 5000.0)
    user_personal_forgetting_coefficient = (
        lambda0_value
        + gamma_value * (1.0 - accuracy_value)
        - delta_value * (1.0 - sigma_t_norm_value)
    )
    return max(0.0, user_personal_forgetting_coefficient)


def run_sm2_step(
    confidence_score_q: int,
    previous_easiness_factor_ef: float,
    repetition_sequence_number: int,
    previous_interval_days_count: int,
    calculated_topic_entropy_value: float,
    user_personal_forgetting_coefficient: float,
) -> tuple[float, int]:
    """
    Выполняет один шаг модифицированного SM-2 с энтропией и забыванием.

    1) EF_new:
      EF_new = EF_old + (0.1 - (5 - Q) * (0.08 + (5 - Q) * 0.02))
      EF_new ограничивается диапазоном [1.3, 2.5].

    2) Базовый интервал:
      - если n == 0: I_base = 1
      - если n == 1: I_base = 6
      - если n > 1:  I_base = I_previous * EF_new

    3) Модификаторы:
      I_final = I_base * (1 / (1 + H(T) * 0.5)) * (1 - λ_i)
    """
    confidence_score_q_value = max(0, min(5, confidence_score_q))
    q_term = 5.0 - float(confidence_score_q_value)
    ef_delta = 0.1 - q_term * (0.08 + q_term * 0.02)
    calculated_new_easiness_factor = previous_easiness_factor_ef + ef_delta
    calculated_new_easiness_factor = max(
        1.3, min(2.5, calculated_new_easiness_factor)
    )

    if repetition_sequence_number == 0:
        base_interval_days = 1
    elif repetition_sequence_number == 1:
        base_interval_days = 6
    else:
        base_interval_days = round(
            previous_interval_days_count * calculated_new_easiness_factor
        )

    forgetting_rate_value = max(
        0.0, min(1.0, user_personal_forgetting_coefficient)
    )
    entropy_scaling_value = 1.0 / (
        1.0 + calculated_topic_entropy_value * 0.5
    )
    i_final_float = (
        float(base_interval_days)
        * entropy_scaling_value
        * (1.0 - forgetting_rate_value)
    )
    modified_repetition_interval = max(1, round(i_final_float))
    return calculated_new_easiness_factor, modified_repetition_interval
