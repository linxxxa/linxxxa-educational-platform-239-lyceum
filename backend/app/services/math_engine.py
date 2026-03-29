"""
Математический движок проекта (чистые функции).

Здесь собрана вся вычислительная логика: энтропия темы, энергия, персональное
забывание и шаг модифицированного SM-2. Модуль не обращается к БД и Redis.
"""

from __future__ import annotations

import math
import statistics

# Flashcard Engine 239 — расход энергии E (динамика по τ и Q)
ENERGY_DRAIN_ALPHA = 2.0
ENERGY_DRAIN_BETA = 1.5
# Пороги когнитивной нагрузки по времени ответа τ (мс)
RESPONSE_TIME_AUTOMATIC_MS = 2000.0
RESPONSE_TIME_HIGH_LOAD_MS = 15000.0


def _binary_outcome_entropy_bits(probability_error: float) -> float:
    """
    Энтропия Шеннона для бинарного исхода {ошибка / верно} с P(ошибка)=p.

    При отсутствии данных берём p=0.5 — это максимум неопределённости (1 бит
    на подтему), а не заниженное значение -p·log2(p).
    """
    p = float(probability_error)
    if p <= 0.0 or p >= 1.0:
        return 0.0
    q = 1.0 - p
    return -(p * math.log2(p) + q * math.log2(q))


def calculate_topic_entropy(
    error_rates: list[float],
    connections_count: int,
    alpha: float = 0.1,
) -> float:
    """
    Рассчитывает сложность темы H(T).

    По ИП для каждой подтемы (вероятность ошибки p_i) вклад — бинарная
    энтропия -p_i·log2(p_i) - (1-p_i)·log2(1-p_i). При отсутствии данных
    p_i = 0.5 → максимальная неопределённость по этой подтеме.

    Итог: H(T) = Σ h_i + α·C, где C — число связей (концептов).
    """
    probabilities_list = error_rates if error_rates else [0.5]
    entropy_bits_sum = 0.0
    for probability_p_i in probabilities_list:
        entropy_bits_sum += _binary_outcome_entropy_bits(probability_p_i)
    calculated_topic_entropy_value = (
        entropy_bits_sum + alpha * float(connections_count)
    )
    return max(0.0, calculated_topic_entropy_value)


def calculate_pi_list_from_error_history(
    subtopic_error_counts: list[int],
    subtopic_total_counts: list[int],
    *,
    default_pi: float = 0.5,
) -> list[float]:
    """Бэкенд-действие для формулы H(T).

    рассчитывает pi (вероятность ошибки) по подтемам на основе истории.

    Если для подтемы нет данных (total_count == 0) → pi = default_pi (0.5).
    """
    pi_list: list[float] = []
    for error_count, total_count in zip(
        subtopic_error_counts, subtopic_total_counts
    ):
        if total_count <= 0:
            pi_list.append(float(default_pi))
        else:
            pi_list.append(float(error_count) / float(total_count))
    return pi_list


def update_energy(
    current_energy: float,
    response_thinking_time_ms: float,
    user_subjective_confidence_score_q: float,
    is_correct: bool,
) -> float:
    """
    Обновляет когнитивную энергию пользователя E после ответа карточки.

    Стоимость ответа не зависит от статической сложности карточки (L_card);
    только время раздумья τ (мс) и субъективная уверенность Q (0–5).

    Строгая динамика по 239-протоколу:
    - energy_drain = alpha * log(response_time_ms) + beta * (5 - Q)
    - alpha = 2, beta = 1.5
    - Если τ < 2000мс: низкая когнитивная нагрузка → снижаем drain
    - Если τ > 15000мс: высокая нагрузка → увеличиваем drain
      даже при верном ответе
    - Если ответ неверный: drain *= 1.5
    """
    response_time_ms_value = max(1.0, float(response_thinking_time_ms))
    q_value = max(0.0, min(5.0, float(user_subjective_confidence_score_q)))

    # energy_drain = α·log(τ) + β·(5 − Q)
    time_term = ENERGY_DRAIN_ALPHA * math.log(response_time_ms_value)
    uncertainty_term = ENERGY_DRAIN_BETA * (5.0 - q_value)
    calculated_interaction_energy_drain = max(
        0.0, time_term + uncertainty_term
    )

    # τ: «автоматический» ответ / высокая нагрузка
    if response_time_ms_value < RESPONSE_TIME_AUTOMATIC_MS:
        calculated_interaction_energy_drain *= 0.5
    if response_time_ms_value > RESPONSE_TIME_HIGH_LOAD_MS:
        calculated_interaction_energy_drain *= 1.5
    if not is_correct:
        calculated_interaction_energy_drain *= 1.5

    new_energy_value = current_energy - calculated_interaction_energy_drain
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
    response_thinking_time_ms: float,
    *,
    previous_success_quality_q: int | None = None,
) -> tuple[float, int, bool]:
    """Шаг SM-2 по 239-протоколу: сложность = динамика (H(T), λi, Q).

    Возвращает (новый EF, интервал в днях, fast_track_week).
    Fast Track (Q=5): первый успех → 2 дня; второй подряд успех с Q=5 → 7 дней.
    """
    # response_thinking_time_ms влияет на λi,
    # поэтому здесь не используется напрямую.
    _ = response_thinking_time_ms

    confidence_score_q_value = max(0, min(5, int(confidence_score_q)))
    repetition_n = max(0, int(repetition_sequence_number))

    # По протоколу 239: если Q < 3 (низкое качество/неверно),
    # интервал принудительно
    # сводится к 1 дню, чтобы быстро "поймать" материал до забывания.
    q_is_low_value = confidence_score_q_value < 3

    # EFnew = EFold + (0.1 − (5 − Q) ⋅ (0.08 + (5 − Q) ⋅ 0.02))
    q_term = 5.0 - float(confidence_score_q_value)
    ef_delta = 0.1 - q_term * (0.08 + q_term * 0.02)
    calculated_new_easiness_factor = (
        float(previous_easiness_factor_ef) + ef_delta
    )
    calculated_new_easiness_factor = max(
        1.3, min(2.5, calculated_new_easiness_factor)
    )

    if confidence_score_q_value == 5 and not q_is_low_value:
        if repetition_n == 0:
            return calculated_new_easiness_factor, 2, False
        if (
            repetition_n == 1
            and previous_success_quality_q is not None
            and int(previous_success_quality_q) == 5
        ):
            return calculated_new_easiness_factor, 7, True

    # Mcomplexity = 1 + H(T) ⋅ 0.51
    entropy_driven_interval_compression = (
        1.0 + float(calculated_topic_entropy_value) * 0.51
    )
    # Mforgetting = 1 − λi
    lambda_i_clamped = max(
        0.0, min(1.0, float(user_personal_forgetting_coefficient))
    )
    cumulative_forgetting_personal_factor = 1.0 - lambda_i_clamped

    i_previous_days = int(previous_interval_days_count)
    in_previous_days_count = i_previous_days if i_previous_days > 0 else 1

    interval_days_float = (
        float(in_previous_days_count)
        * calculated_new_easiness_factor
        * entropy_driven_interval_compression
        * cumulative_forgetting_personal_factor
    )
    modified_repetition_interval = (
        1 if q_is_low_value else max(1, round(interval_days_float))
    )
    return calculated_new_easiness_factor, modified_repetition_interval, False


def calculate_session_delta_t_hours(
    cognitive_energy_level_e: float,
    *,
    t_minutes_value: float = 25.0,
    beta_value: float = 0.05,
) -> float:
    """Δt = T ⋅ (1 − exp(−βE)), где T=25 минут, β=0.05.

    Возвращает длительность в часах.
    """
    e_value = max(0.0, float(cognitive_energy_level_e))
    delta_minutes = float(t_minutes_value) * (
        1.0 - math.exp(-beta_value * e_value)
    )
    return max(0.0, delta_minutes / 60.0)


def calculate_readiness_index_ri(
    mastery_levels: list[float],
    total_learning_hours: float,
) -> float:
    """RI = 700⋅Mnorm + 200⋅σnorm + 100⋅τnorm, ограничено [0..1000]."""
    if not mastery_levels:
        return 0.0

    mastery_mean_value = sum(mastery_levels) / float(len(mastery_levels))
    mastery_std_value = statistics.pstdev(mastery_levels)

    m_norm_value = max(0.0, mastery_mean_value / 100.0)
    sigma_norm_value = max(0.0, 1.0 - mastery_std_value / 25.0)

    t_hours = max(0.0, float(total_learning_hours))
    tau_norm_value = math.log10(t_hours + 1.0) / 3.0

    ri_value = (
        700.0 * m_norm_value
        + 200.0 * sigma_norm_value
        + 100.0 * tau_norm_value
    )
    return max(0.0, min(1000.0, ri_value))


def calculate_session_efficiency_eta(
    initial_mastery_m0: float,
    final_mastery: float,
    session_duration_hours: float,
    unique_topics_count_k: int,
) -> float:
    """η = (ΔM ⋅ log2(K + 1)) / ((M0 + 0.1) ⋅ t_hours)."""
    if session_duration_hours <= 1e-12:
        return 0.0

    k_value = max(0, int(unique_topics_count_k))
    delta_m_value = float(final_mastery) - float(initial_mastery_m0)
    numerator_value = delta_m_value * math.log2(k_value + 1.0)
    denominator_value = (float(initial_mastery_m0) + 0.1) * float(
        session_duration_hours
    )
    if denominator_value <= 0.0:
        return 0.0
    return max(0.0, numerator_value / denominator_value)
