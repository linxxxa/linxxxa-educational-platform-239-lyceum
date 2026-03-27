"""Pydantic-схемы для сессий обучения."""
from pydantic import BaseModel, field_validator


class UserAnswerSubmission(BaseModel):
    """Ответ пользователя на карточку.

    Содержит ID карточки, корректность, уверенность (Q 0–5) и время
    раздумья. По ТЗ Q вычисляется в обработчике из:
    - is_correct (был ли ответ верным),
    - user_subjective_confidence_score (оценка уверенности пользователя 0–5).
    """
    target_card_unique_identifier: int
    submitted_user_answer_is_correct: bool
    user_subjective_confidence_score: float
    response_thinking_time_seconds: float

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


class StudyAnswerRequest(BaseModel):
    """
    Запрос на обработку ответа по карточке.
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
