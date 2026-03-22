"""
Pydantic-схемы для работы с пользовательскими данными.
Содержит валидацию для регистрации и отображения.
"""
from pydantic import BaseModel, EmailStr, field_validator


class UserAccountCreate(BaseModel):
    """
    Схема для создания нового пользователя при регистрации.
    Валидирует полное имя, email и пароль перед сохранением в БД.
    """
    user_full_display_name: str
    user_email_address: EmailStr
    plain_text_password_for_hashing: str

    @field_validator("plain_text_password_for_hashing")
    @classmethod
    def validate_password_minimum_length(cls, password_value: str) -> str:
        """Проверка минимальной длины пароля (8 символов)."""
        if len(password_value) < 8:
            raise ValueError("Пароль должен содержать не менее 8 символов")
        return password_value

    @field_validator("user_full_display_name")
    @classmethod
    def validate_display_name_not_empty(cls, display_name_value: str) -> str:
        """Проверка, что имя пользователя не пустое."""
        stripped_name = display_name_value.strip()
        if not stripped_name:
            raise ValueError("Полное имя не может быть пустым")
        return stripped_name


class UserAccountPublicInformation(BaseModel):
    """
    Публичная схема: только безопасные поля для отображения в API.
    Исключены пароли (даже хешированные) — схема фильтрует конфиденциальные данные.
    """
    user_unique_identifier: int
    user_full_display_name: str
    user_email_address: str
    current_cognitive_energy_level: float
