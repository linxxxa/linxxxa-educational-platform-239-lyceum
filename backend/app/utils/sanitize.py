"""
Нормализация пользовательских строк: trim, запрет управляющих символов.
SQLAlchemy использует параметризованные запросы; дополнительно убираем опасный мусор.
"""
import re
from typing import Optional

# Управляющие символы (кроме таба/перевода строки в многострочных полях)
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def strip_whitespace(value: str) -> str:
    """Убирает пробелы по краям."""
    return value.strip()


def reject_control_characters(value: str) -> str:
    """Отклоняет строки с нулевыми байтами и прочим управляющим мусором."""
    if _CONTROL_RE.search(value):
        raise ValueError("Недопустимые символы в строке")
    return value


def normalize_optional_text(value: Optional[str], max_len: int) -> Optional[str]:
    """Опциональное поле: None или trim + длина."""
    if value is None:
        return None
    s = strip_whitespace(value)
    if not s:
        return None
    s = reject_control_characters(s)
    if len(s) > max_len:
        raise ValueError(f"Текст не длиннее {max_len} символов")
    return s


def assert_safe_display_name(value: str, *, max_len: int = 100) -> str:
    """
    Имя для отображения (тема, предмет, логин без спец-разметки): без < >.
    """
    s = strip_whitespace(value)
    reject_control_characters(s)
    if not s:
        raise ValueError("Название не может быть пустым")
    if len(s) > max_len:
        raise ValueError("Слишком длинное название (макс. 100 симв.)")
    if "<" in s or ">" in s:
        raise ValueError("Символы < и > запрещены")
    return s


def assert_safe_optional_description(value: Optional[str], max_len: int = 2000) -> Optional[str]:
    """Описание: допускается пустое; иначе без < >."""
    if value is None:
        return None
    s = strip_whitespace(value)
    if not s:
        return None
    reject_control_characters(s)
    if len(s) > max_len:
        raise ValueError(f"Описание не длиннее {max_len} символов")
    if "<" in s or ">" in s:
        raise ValueError("Символы < и > запрещены")
    return s
