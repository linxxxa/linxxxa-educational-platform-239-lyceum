"""
Модель обучающей карточки. Привязана к теме (H(T)) и пользователю.
card_repetition_sequence_number — число успешных повторений; выбирает
множитель в SM-2 (например, n=0→1 день, n=1→6 дней).
"""
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Integer,
    Text,
)
from sqlalchemy.orm import relationship, synonym

from app.database import Base_Model_Declarative_Root


class LearningCardTypeEnum(PyEnum):
    """Тип карточки (раздел 4.1 ТЗ)."""

    concept = "понятие"
    formula = "формула"
    task = "задача"


class LearningCardModel(Base_Model_Declarative_Root):
    """
    Персональная карточка: вопрос, ответ, параметры SM-2.
    Привязка к владельцу и теме для расчёта энтропии и приватности.
    """
    __tablename__ = "learning_cards"

    card_unique_identifier = Column(Integer, primary_key=True, index=True)
    owner_user_account_id = Column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        nullable=False,
    )
    parent_topic_reference_id = Column(
        Integer,
        ForeignKey("learning_topics.topic_unique_identifier"),
        nullable=False,
        index=True,
    )

    # Поле card_question_text_payload хранит LaTeX-формулы (длинный текст).
    card_question_text_payload = Column(Text, nullable=False)
    question_text = synonym("card_question_text_payload")
    card_content_question_latex = synonym("card_question_text_payload")
    card_answer_text_payload = Column(Text, nullable=False)
    card_content_answer_latex = synonym("card_answer_text_payload")

    # Тип карточки влияет на будущие UI-представления и логику анализа.
    card_type = Column(
        SQLEnum(LearningCardTypeEnum),
        nullable=False,
        default=LearningCardTypeEnum.concept,
    )
    card_type_category = synonym("card_type")

    card_easiness_factor_ef = Column(Float, default=2.5)
    easiness_factor_coefficient = synonym("card_easiness_factor_ef")
    card_repetition_sequence_number = Column(Integer, default=0)
    card_next_review_datetime = Column(DateTime, index=True, nullable=True)
    card_last_interval_days = Column(Integer, default=0)
    card_owner = relationship(
        "UserAccountModel", back_populates="owned_learning_cards"
    )
    parent_topic = relationship(
        "LearningTopicModel", back_populates="learning_cards_in_topic"
    )

    learning_card_interactions = relationship(
        "LearningInteractionsModel",
        back_populates="interaction_target_learning_card",
    )

    learning_card_user_card_progresses = relationship(
        "UserCardProgressModel",
        back_populates="progress_target_learning_card",
    )
