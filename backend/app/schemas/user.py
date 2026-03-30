"""
Pydantic-схемы для работы с пользовательскими данными.
Содержит валидацию для регистрации и отображения.
"""
from pydantic import BaseModel, Field, field_validator

from email_validator import EmailNotValidError, validate_email

_WEAK_PASSWORDS_LOWER = frozenset(
    {
        "12345678",
        "123456789",
        "1234567890",
        "11111111",
        "87654321",
        "password",
        "password123",
        "qwerty123",
        "admin123",
        "letmein",
        "welcome1",
    }
)


class UserAccountCreate(BaseModel):
    """
    Схема для создания нового пользователя при регистрации.
    Валидирует полное имя, email и пароль перед сохранением в БД.
    """
    user_full_display_name: str
    user_email_address: str
    plain_text_password_for_hashing: str
    deck_share_token: str | None = Field(
        default=None,
        description="Токен приглашения забрать колоду из письма",
        max_length=96,
    )

    @field_validator("user_full_display_name")
    @classmethod
    def validate_display_name_not_empty(cls, display_name_value: str) -> str:
        from app.utils.sanitize import assert_safe_display_name

        return assert_safe_display_name(display_name_value, max_len=100)

    @field_validator("user_email_address")
    @classmethod
    def validate_email_field(cls, v: str) -> str:
        from app.utils.sanitize import reject_control_characters, strip_whitespace

        s = strip_whitespace(v).lower()
        reject_control_characters(s)
        if len(s) < 5 or len(s) > 100:
            raise ValueError("Email должен быть от 5 до 100 символов")
        try:
            validate_email(s, check_deliverability=False)
        except EmailNotValidError:
            raise ValueError("Некорректный формат email") from None
        if "<" in s or ">" in s:
            raise ValueError("Недопустимые символы в email")
        return s

    @field_validator("plain_text_password_for_hashing")
    @classmethod
    def validate_password_strength(cls, password_value: str) -> str:
        if len(password_value) < 8:
            raise ValueError("Пароль должен содержать не менее 8 символов")
        if len(password_value) > 100:
            raise ValueError("Пароль не более 100 символов")
        if password_value.lower() in _WEAK_PASSWORDS_LOWER:
            raise ValueError("Пароль слишком простой — выберите другой")
        return password_value

    @field_validator("deck_share_token")
    @classmethod
    def trim_deck_share_token(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        return t or None


class UserAccountPublicInformation(BaseModel):
    """
    Публичная схема: только безопасные поля для отображения в API.
    Исключены пароли (даже хешированные) — схема фильтрует конфиденциальные данные.
    """
    user_unique_identifier: int
    user_full_display_name: str
    user_email_address: str
    current_cognitive_energy_level: float
