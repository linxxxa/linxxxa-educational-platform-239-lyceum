"""Схемы контент-модуля (Subjects, Topics, Cards) — 239 Protocol DTO."""
from typing import Literal

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, Field, field_validator


class SubjectMetadataTransferObject(BaseModel):
    """Метаданные предмета для API."""

    subject_display_name: str
    subject_description_text: str | None = None

    @field_validator("subject_display_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        """Очищает и валидирует название предмета."""
        s = v.strip()
        if not s:
            raise ValueError("Название предмета обязательно")
        return s


class LearningSubjectResponseSchema(BaseModel):
    """Ответ API: предмет."""

    subject_unique_identifier: int
    subject_display_name: str
    subject_description_text: str | None
    created_by_user_id: int


class CardPayloadItem(BaseModel):
    """Элемент new_card_payload_collection."""

    card_content_question_latex: str
    card_content_answer_latex: str
    card_type_category: Literal["CONCEPT", "FORMULA", "TASK"]

    @field_validator("card_content_question_latex", "card_content_answer_latex")
    @classmethod
    def non_empty_tex(cls, v: str) -> str:
        """Проверяет, что LaTeX поле не пустое и не слишком длинное."""
        s = v.strip()
        if not s:
            raise ValueError("Поля LaTeX не могут быть пустыми")
        if len(s) > 100_000:
            raise ValueError("Слишком длинный текст")
        return s


class DeckBatchSaveRequest(BaseModel):
    """Пакетное сохранение колоды: тема + карточки в одной транзакции."""

    parent_subject_reference_id: int
    topic_title_name: str
    topic_description_text: str | None = None
    new_card_payload_collection: list[CardPayloadItem] = Field(min_length=1)

    @field_validator("topic_title_name")
    @classmethod
    def topic_name_ok(cls, v: str) -> str:
        """Проверяет, что название темы непустое."""
        s = v.strip()
        if not s:
            raise ValueError("Название темы обязательно")
        return s


class TopicUpdateRequest(BaseModel):
    """Обновление метаданных темы/колоды."""

    topic_display_name: str | None = None
    topic_description_text: str | None = None
    parent_subject_reference_id: int | None = None

    @field_validator("topic_display_name")
    @classmethod
    def validate_topic_display_name(cls, v: str | None) -> str | None:
        """Проверяет, что название темы непустое (если передано)."""
        if v is None:
            return None
        s = v.strip()
        if not s:
            raise ValueError("Название темы обязательно")
        return s


class TopicCardsBatchAddRequest(BaseModel):
    """Пакетное добавление карточек в существующую колоду."""

    new_card_payload_collection: list[CardPayloadItem] = Field(min_length=1)


class DeckShareByEmailRequest(BaseModel):
    """Отправка копии колоды другому пользователю по email."""

    email: str

    @field_validator("email")
    @classmethod
    def normalize_and_validate_email(cls, v: str) -> str:
        s = v.strip()
        if len(s) < 5 or len(s) > 255:
            raise ValueError("Email должен быть от 5 до 255 символов")
        try:
            validate_email(s, check_deliverability=False)
        except EmailNotValidError:
            raise ValueError("Некорректный формат email") from None
        return s.lower()
