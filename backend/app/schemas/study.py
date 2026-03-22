"""
Pydantic-схемы для сессий обучения.
"""
from pydantic import BaseModel, field_validator


class UserAnswerSubmission(BaseModel):
    """
    Ответ на карточку: ID карточки, признак корректности ответа,
    уверенность и время раздумья.

    По ТЗ Q (0–5) вычисляется в обработчике из:
    - is_correct (был ли ответ верным),
    - user_subjective_confidence_score (оценка уверенности пользователя 0–5).
    """
    target_card_unique_identifier: int
    submitted_user_answer_is_correct: bool
    user_subjective_confidence_score: float
    response_thinking_time_seconds: float

    @field_validator("user_subjective_confidence_score")
    @classmethod
    def validate_confidence_in_range(cls, value: float) -> float:
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
        if not 0 <= value <= 5:
            raise ValueError("Оценка уверенности должна быть от 0 до 5")
        return value
