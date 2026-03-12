"""
Модель обучающей карточки. Привязана к теме (H(T)) и пользователю.
card_repetition_sequence_number — число успешных повторений; выбирает
множитель в SM-2 (например, n=0→1 день, n=1→6 дней).
"""
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base_Model_Declarative_Root


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
    )
    card_question_text_payload = Column(String, nullable=False)
    card_answer_text_payload = Column(String, nullable=False)
    card_easiness_factor_ef = Column(Float, default=2.5)
    card_repetition_sequence_number = Column(Integer, default=0)
    card_next_review_datetime = Column(DateTime, index=True, nullable=True)
    card_last_interval_days = Column(Integer, default=0)
    card_owner = relationship(
        "UserAccountModel", back_populates="owned_learning_cards"
    )
    parent_topic = relationship(
        "LearningTopicModel", back_populates="learning_cards_in_topic"
    )
