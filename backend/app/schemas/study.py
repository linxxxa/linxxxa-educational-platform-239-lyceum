"""Pydantic-схемы для сессий обучения."""
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class UserAnswerSubmission(BaseModel):
    """Ответ пользователя на карточку.

    Содержит ID карточки, корректность, уверенность (Q 0–5) и время
    раздумья. По ТЗ Q вычисляется в обработчике из:
    - is_correct (был ли ответ верным),
    - user_subjective_confidence_score (оценка уверенности пользователя 0–5).

    Время можно передать как ``response_thinking_time_seconds`` или
    ``response_thinking_time_ms`` (приоритет у миллисекунд).

    """

    target_card_unique_identifier: int
    submitted_user_answer_is_correct: bool
    user_subjective_confidence_score: float
    response_thinking_time_seconds: float | None = None
    response_thinking_time_ms: float | None = None

    # Доп. поля для UX-диагностики и точного замера (239 Flashcard Engine).
    user_answer: str | None = None
    current_session_energy: float | None = None

    @field_validator("user_subjective_confidence_score")
    @classmethod
    def validate_confidence_in_range(cls, value: float) -> float:
        """Проверяет диапазон уверенности 0..5."""
        if not 0 <= value <= 5:
            raise ValueError("Оценка уверенности должна быть от 0 до 5")
        return value

    @model_validator(mode="after")
    def normalize_response_thinking_time(self) -> "UserAnswerSubmission":
        """Приводит время ответа к секундам для единого pipeline."""
        if self.response_thinking_time_ms is not None:
            sec = float(self.response_thinking_time_ms) / 1000.0
            object.__setattr__(self, "response_thinking_time_seconds", sec)
        if self.response_thinking_time_seconds is None:
            raise ValueError(
                "Укажите response_thinking_time_seconds "
                "или response_thinking_time_ms"
            )
        return self


class StudyAnswerRequest(BaseModel):
    """Запрос на обработку ответа по карточке.

    confidence_score_q: 0–5 (субъективная уверенность).

    """

    card_unique_identifier: int
    user_subjective_confidence_score: float
    time_spent_on_thinking_seconds: float

    @field_validator("user_subjective_confidence_score")
    @classmethod
    def validate_confidence_in_range(cls, value: float) -> float:
        """Проверяет диапазон уверенности 0..5."""
        if not 0 <= value <= 5:
            raise ValueError("Оценка уверенности должна быть от 0 до 5")
        return value


class SessionInteractionItem(BaseModel):
    """Один ответ в сессии (для итогового summary с клиента)."""

    is_correct: bool
    response_time_ms: int = Field(..., ge=0, le=3_600_000)
    topic_id: int


class SessionFinishPayload(BaseModel):
    """Опциональные данные завершения: точнее, чем только Redis."""

    interactions: list[SessionInteractionItem] | None = None
    ri_before_snapshot: float | None = None
    started_at_ts: float | None = None
    session_summary: dict[str, Any] | None = Field(
        default=None,
        description="Сводка с клиента (карточки сессии и т.д.); точность — из interactions или БД.",
    )
