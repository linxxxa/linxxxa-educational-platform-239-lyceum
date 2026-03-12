"""
Pydantic-схемы для тем обучения (Граф Знаний).
"""
from pydantic import BaseModel, field_validator


class LearningTopicSchema(BaseModel):
    """
    Схема для создания темы: название, описание, родитель.
    topic_entropy_complexity_value задаётся при создании или позже сервисом.
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
