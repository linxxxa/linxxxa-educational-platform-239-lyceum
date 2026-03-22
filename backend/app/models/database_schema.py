"""
Схема базы данных по ИП (SQLAlchemy 2.0).

Объединяет все таблицы с детальными именами полей, связями и индексами
для расчёта математических формул (Entropy, Energy, RI, η, λ_i, SM-2).
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Базовый класс для всех моделей (SQLAlchemy 2.0)."""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────


class LearningCardTypeEnum(PyEnum):
    """Тип карточки: понятие, формула, задача."""

    concept = "понятие"
    formula = "формула"
    task = "задача"


class UserSubjectiveConfidenceScoreEnum(PyEnum):
    """Уровень уверенности пользователя при ответе."""

    easy = "легко"
    medium = "средне"
    hard = "тяжело"


# ─────────────────────────────────────────────────────────────────────────────
# 1. UserAccounts
# ─────────────────────────────────────────────────────────────────────────────


class UserAccountsTable(Base):
    """
    Таблица учётных записей пользователей.
    Содержит поля для аутентификации и метрик адаптивного обучения.
    """

    __tablename__ = "user_accounts"

    user_unique_identifier: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True, index=True
    )
    user_full_display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_email_address: Mapped[str] = mapped_column(
        String(320), unique=True, index=True, nullable=False
    )
    user_hashed_password_string: Mapped[str] = mapped_column(String(255), nullable=False)

    current_cognitive_energy_level: Mapped[float] = mapped_column(
        Float, default=100.0, nullable=False
    )
    global_mastery_coefficient: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )
    personal_forgetting_lambda: Mapped[float] = mapped_column(
        Float, default=0.05, nullable=False
    )
    total_learning_hours: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )
    average_response_time_seconds: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )
    knowledge_deviation_sigma: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )
    last_calculated_readiness_index: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )
    last_calculated_learning_efficiency_eta: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )

    owned_subjects: Mapped[list["SubjectsTable"]] = relationship(
        "SubjectsTable",
        back_populates="subject_owner_user_account",
        foreign_keys="SubjectsTable.subject_owner_user_account_id",
    )
    owned_topics: Mapped[list["TopicsTable"]] = relationship(
        "TopicsTable",
        back_populates="topic_owner_user_account",
        foreign_keys="TopicsTable.topic_owner_user_account_id",
    )
    owned_learning_cards: Mapped[list["LearningCardsTable"]] = relationship(
        "LearningCardsTable",
        back_populates="learning_card_owner_user_account",
    )
    owned_user_card_progresses: Mapped[list["UserCardProgressTable"]] = (
        relationship(
            "UserCardProgressTable",
            back_populates="progress_owner_user_account",
        )
    )
    owned_learning_interactions: Mapped[list["LearningInteractionsTable"]] = (
        relationship(
            "LearningInteractionsTable",
            back_populates="interaction_owner_user_account",
        )
    )
    owned_study_sessions: Mapped[list["StudySessionsTable"]] = relationship(
        "StudySessionsTable",
        back_populates="study_session_owner_user_account",
    )


# ─────────────────────────────────────────────────────────────────────────────
# 2. Subjects и Topics
# ─────────────────────────────────────────────────────────────────────────────


class SubjectsTable(Base):
    """
    Таблица предметов (учебных дисциплин).
    Родительская сущность для Topics.
    """

    __tablename__ = "subjects"

    subject_unique_identifier: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True, index=True
    )
    subject_display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject_description_text: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    subject_owner_user_account_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        nullable=True,
        index=True,
    )

    subject_owner_user_account: Mapped[Optional["UserAccountsTable"]] = (
        relationship(
            "UserAccountsTable",
            back_populates="owned_subjects",
            foreign_keys=[subject_owner_user_account_id],
        )
    )
    child_topics: Mapped[list["TopicsTable"]] = relationship(
        "TopicsTable",
        back_populates="parent_subject",
    )


class TopicsTable(Base):
    """
    Таблица тем обучения. Входит в Граф Знаний.
    Связана с Subject, содержит related_topics_count и topic_entropy_value.
    """

    __tablename__ = "topics"

    topic_unique_identifier: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True, index=True
    )
    topic_display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    topic_description_text: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    topic_entropy_value: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )
    related_topics_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    parent_subject_reference_identifier: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("subjects.subject_unique_identifier"),
        nullable=True,
        index=True,
    )
    parent_topic_reference_identifier: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("topics.topic_unique_identifier"),
        nullable=True,
        index=True,
    )
    topic_owner_user_account_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        nullable=True,
        index=True,
    )

    parent_subject: Mapped[Optional["SubjectsTable"]] = relationship(
        "SubjectsTable",
        back_populates="child_topics",
    )
    parent_topic: Mapped[Optional["TopicsTable"]] = relationship(
        "TopicsTable",
        remote_side=[topic_unique_identifier],
        back_populates="child_subtopics",
    )
    child_subtopics: Mapped[list["TopicsTable"]] = relationship(
        "TopicsTable",
        back_populates="parent_topic",
    )
    topic_owner_user_account: Mapped[Optional["UserAccountsTable"]] = (
        relationship(
            "UserAccountsTable",
            back_populates="owned_topics",
            foreign_keys=[topic_owner_user_account_id],
        )
    )
    learning_cards_in_topic: Mapped[list["LearningCardsTable"]] = (
        relationship(
            "LearningCardsTable",
            back_populates="parent_topic",
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3. LearningCards
# ─────────────────────────────────────────────────────────────────────────────


class LearningCardsTable(Base):
    """
    Персональные обучающие карточки.
    card_type Enum, difficulty_level_L 1–5, LaTeX-совместимые текстовые поля.
    """

    __tablename__ = "learning_cards"

    __table_args__ = (
        CheckConstraint(
            "difficulty_level_L >= 1 AND difficulty_level_L <= 5",
            name="learning_cards_difficulty_level_L_range_check",
        ),
    )

    card_unique_identifier: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True, index=True
    )
    learning_card_owner_user_account_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        nullable=False,
        index=True,
    )
    parent_topic_reference_identifier: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("topics.topic_unique_identifier"),
        nullable=False,
        index=True,
    )
    card_question_text_payload_latex: Mapped[str] = mapped_column(
        Text, nullable=False
    )
    card_answer_text_payload_latex: Mapped[str] = mapped_column(
        Text, nullable=False
    )
    card_type: Mapped[LearningCardTypeEnum] = mapped_column(
        SQLEnum(LearningCardTypeEnum),
        nullable=False,
        default=LearningCardTypeEnum.concept,
    )
    difficulty_level_L: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )

    learning_card_owner_user_account: Mapped["UserAccountsTable"] = (
        relationship(
            "UserAccountsTable",
            back_populates="owned_learning_cards",
        )
    )
    parent_topic: Mapped["TopicsTable"] = relationship(
        "TopicsTable",
        back_populates="learning_cards_in_topic",
    )
    user_card_progresses: Mapped[list["UserCardProgressTable"]] = (
        relationship(
            "UserCardProgressTable",
            back_populates="progress_target_learning_card",
        )
    )
    learning_card_interactions: Mapped[list["LearningInteractionsTable"]] = (
        relationship(
            "LearningInteractionsTable",
            back_populates="interaction_target_learning_card",
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4. UserCardProgress
# ─────────────────────────────────────────────────────────────────────────────


class UserCardProgressTable(Base):
    """
    Связка User–Card. Хранит EF, номер повторения, дату следующего
    повторения и уровень мастерства.
    """

    __tablename__ = "user_card_progress"

    __table_args__ = (
        Index(
            "ix_user_card_progress_next_review_datetime",
            "next_review_datetime",
        ),
        Index(
            "ix_user_card_progress_user_id",
            "progress_owner_user_account_id",
        ),
        CheckConstraint(
            "easiness_factor_ef >= 1.3 AND easiness_factor_ef <= 2.5",
            name="user_card_progress_easiness_factor_ef_range_check",
        ),
    )

    progress_owner_user_account_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        primary_key=True,
        index=True,
    )
    progress_target_card_unique_identifier: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("learning_cards.card_unique_identifier"),
        primary_key=True,
        index=True,
    )
    easiness_factor_ef: Mapped[float] = mapped_column(
        Float, nullable=False, default=1.3
    )
    repetition_sequence_number: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    next_review_datetime: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, index=True
    )
    mastery_level: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )

    progress_owner_user_account: Mapped["UserAccountsTable"] = relationship(
        "UserAccountsTable",
        back_populates="owned_user_card_progresses",
    )
    progress_target_learning_card: Mapped["LearningCardsTable"] = (
        relationship(
            "LearningCardsTable",
            back_populates="user_card_progresses",
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. LearningInteractions
# ─────────────────────────────────────────────────────────────────────────────


class LearningInteractionsTable(Base):
    """
    Лог ответов пользователя на карточки.
    response_time_ms, is_correct, user_confidence_score.
    """

    __tablename__ = "learning_interactions"

    __table_args__ = (
        Index(
            "ix_learning_interactions_user_id",
            "interaction_owner_user_account_id",
        ),
    )

    interaction_unique_identifier: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True, index=True
    )
    interaction_owner_user_account_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        nullable=False,
        index=True,
    )
    interaction_target_card_unique_identifier: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("learning_cards.card_unique_identifier"),
        nullable=False,
        index=True,
    )
    response_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    user_confidence_score: Mapped[UserSubjectiveConfidenceScoreEnum] = (
        mapped_column(
            SQLEnum(UserSubjectiveConfidenceScoreEnum),
            nullable=False,
        )
    )
    interaction_timestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    interaction_owner_user_account: Mapped["UserAccountsTable"] = (
        relationship(
            "UserAccountsTable",
            back_populates="owned_learning_interactions",
        )
    )
    interaction_target_learning_card: Mapped["LearningCardsTable"] = (
        relationship(
            "LearningCardsTable",
            back_populates="learning_card_interactions",
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6. StudySessions
# ─────────────────────────────────────────────────────────────────────────────


class StudySessionsTable(Base):
    """
    Статистика сессии обучения для расчёта эффективности η.
    Хранит начальное/конечное мастерство, длительность, число тем.
    """

    __tablename__ = "study_sessions"

    __table_args__ = (
        Index(
            "ix_study_sessions_user_id",
            "study_session_owner_user_account_id",
        ),
    )

    study_session_unique_identifier: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True, index=True
    )
    study_session_owner_user_account_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        nullable=False,
        index=True,
    )
    study_session_started_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False
    )
    study_session_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )
    study_session_duration_hours: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    study_session_initial_mastery_level: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    study_session_final_mastery_level: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    study_session_unique_topics_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    last_calculated_learning_efficiency_eta: Mapped[Optional[float]] = (
        mapped_column(Float, nullable=True)
    )
    last_calculated_readiness_index: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )

    study_session_owner_user_account: Mapped["UserAccountsTable"] = (
        relationship(
            "UserAccountsTable",
            back_populates="owned_study_sessions",
        )
    )


def create_all_tables_from_schema(engine) -> None:
    """
    Создаёт все таблицы схемы в БД.
    Использование: create_all_tables_from_schema(platform_database_engine)
    """
    Base.metadata.create_all(bind=engine)
