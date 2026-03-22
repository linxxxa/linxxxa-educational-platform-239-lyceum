"""
Pydantic-схемы для обучающих карточек.
"""
from pydantic import BaseModel, field_validator


class LearningCardCreate(BaseModel):
    """
    Схема создания карточки. parent_topic_reference_id обязателен.
    """
    parent_topic_reference_id: int
    card_question_text_payload: str
    card_answer_text_payload: str

    @field_validator("card_question_text_payload")
    @classmethod
    def validate_question_not_empty(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Текст вопроса не может быть пустым")
        return stripped

    @field_validator("card_answer_text_payload")
    @classmethod
    def validate_answer_not_empty(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Текст ответа не может быть пустым")
        return stripped
