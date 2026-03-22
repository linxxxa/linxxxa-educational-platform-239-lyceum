"""
Модель логов взаимодействий пользователя с карточками (раздел 4.1 ТЗ).

Таблица Interactions:
- interaction_is_correct (верный/неверный ответ),
- interaction_response_time_ms / response_thinking_time_ms (τ, время раздумья),
- interaction_subjective_confidence_level (легко/средне/тяжело),
- interaction_timestamp (момент ответа).
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
)
from sqlalchemy.orm import relationship, synonym

from app.database import Base_Model_Declarative_Root


class UserSubjectiveConfidenceLevelEnum(PyEnum):
    """Уровень уверенности пользователя при ответе (легко/средне/тяжело)."""

    easy = "легко"
    medium = "средне"
    hard = "тяжело"


class LearningInteractionsModel(Base_Model_Declarative_Root):
    """Таблица логов взаимодействий (Interactions)."""

    __tablename__ = "interactions"

    # Первичный ключ (оставлен прежний DB-столбец).
    interaction_unique_identifier = Column(
        Integer, primary_key=True, index=True
    )

    interaction_owner_user_account_id = Column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        nullable=False,
        index=True,
    )
    interaction_target_card_unique_identifier = Column(
        Integer,
        ForeignKey(
            "learning_cards.card_unique_identifier",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    interaction_is_correct = Column(Boolean, nullable=False)
    interaction_response_time_ms = Column(Integer, nullable=False)
    response_thinking_time_ms = synonym("interaction_response_time_ms")

    interaction_subjective_confidence_level = Column(
        SQLEnum(UserSubjectiveConfidenceLevelEnum),
        nullable=False,
    )
    user_confidence_level = synonym(
        "interaction_subjective_confidence_level"
    )

    # Момент ответа (добавляем как новый столбец).
    interaction_timestamp = Column(
        DateTime,
        nullable=True,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    interaction_owner_user_account = relationship(
        "UserAccountModel",
        back_populates="owned_learning_interactions",
    )
    interaction_target_learning_card = relationship(
        "LearningCardModel",
        back_populates="learning_card_interactions",
    )


LearningInteractionModel = LearningInteractionsModel
