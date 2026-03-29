"""
Затухание освоения по упрощённой модели Эббингауза: M_current = M_initial * exp(-k * t).
k масштабируется от сложности темы H(T) (topic_entropy_complexity_value).
"""

from __future__ import annotations

import math
from datetime import datetime


def decay_mastery_ebbinghaus(
    mastery_initial_pct: float,
    hours_since_last_repetition: float,
    complexity_h: float,
) -> float:
    """
    :param mastery_initial_pct: среднее освоение карточек темы, 0..100
    :param hours_since_last_repetition: часы с последнего ответа по теме
    :param complexity_h: H(T), >0
    """
    m0 = max(0.0, min(100.0, float(mastery_initial_pct)))
    if m0 <= 0:
        return 0.0
    h = max(0.05, min(6.0, float(complexity_h)))
    k = 0.0008 * h
    t = max(0.0, float(hours_since_last_repetition))
    return max(0.0, min(100.0, m0 * math.exp(-k * t)))


def hours_since_last_utc(
    last_ts: datetime | None, now_utc: datetime
) -> float:
    if last_ts is None:
        return 0.0
    delta = now_utc - last_ts
    return max(0.0, delta.total_seconds() / 3600.0)
