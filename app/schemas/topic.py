"""
Pydantic-схемы для тем обучения (Граф Знаний).
"""
from pydantic import BaseModel, field_validator


class LearningTopicCreate(BaseModel):
    """
    Схема для создания темы: название, описание, ID родительской темы.
    """
    topic_display_name: str
    topic_description_text: str | None = None
    parent_topic_reference_identifier: int | None = None

    @field_validator("topic_display_name")
    @classmethod
    def validate_display_name_not_empty(cls, display_name_value: str) -> str:
        """Проверка: название темы не пустое."""
        stripped_name = display_name_value.strip()
        if not stripped_name:
            raise ValueError("Название темы не может быть пустым")
        return stripped_name


class LearningTopicSchema(BaseModel):
    """Схема для ответа API: публичные поля темы."""
    topic_unique_identifier: int
    topic_display_name: str
    topic_description_text: str | None
    topic_entropy_complexity_value: float
    parent_topic_reference_identifier: int | None
    topic_owner_user_id: int | None
