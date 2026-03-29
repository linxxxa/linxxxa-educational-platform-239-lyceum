"""
Прогресс обучения пользователя по конкретной карточке (Progress, раздел 4.1 ТЗ).
Связка User-Card хранит расписание (interval, next_review_date) и мастерство.
"""
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
)
from sqlalchemy.orm import relationship, synonym

from app.database import Base_Model_Declarative_Root


class UserCardProgressModel(Base_Model_Declarative_Root):
    """Таблица прогресса: по связке пользователя и карточки."""

    __tablename__ = "progress"

    progress_owner_user_account_id = Column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        primary_key=True,
    )
    progress_target_card_unique_identifier = Column(
        Integer,
        ForeignKey("learning_cards.card_unique_identifier"),
        primary_key=True,
    )

    progress_easiness_factor = Column(Float, nullable=False, default=1.3)
    easiness_factor_coefficient = synonym("progress_easiness_factor")
    progress_interval_days = Column(Integer, nullable=False, default=1)
    progress_next_review_date = Column(DateTime, nullable=True, index=True)
    progress_mastery_level = Column(Float, nullable=False, default=0.0)
    # Последнее Q (0–5) по ответу на карточку — для очереди сессии и Fast Track.
    progress_last_quality_q = Column(Integer, nullable=True)

    __table_args__ = (
        Index(
            "ix_progress_user_id_next_review_date",
            "progress_owner_user_account_id",
            "progress_next_review_date",
        ),
        CheckConstraint(
            "progress_easiness_factor >= 1.3 AND "
            "progress_easiness_factor <= 2.5",
            name="progress_easiness_factor_range_check",
        ),
    )

    progress_owner_user_account = relationship(
        "UserAccountModel",
        back_populates="owned_user_card_progresses",
    )
    progress_target_learning_card = relationship(
        "LearningCardModel",
        back_populates="learning_card_user_card_progresses",
    )
