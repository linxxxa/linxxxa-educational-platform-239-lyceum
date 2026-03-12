"""
Модель темы обучения — основа Графа Знаний.
topic_entropy_complexity_value (H(T)) участвует в расчёте сложности карточек
и влияет на модифицированный SM-2 (множитель M(complexity)).
"""
from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base_Model_Declarative_Root


class LearningTopicModel(Base_Model_Declarative_Root):
    """
    Таблица тем обучения с древовидной структурой.
    topic_owner_user_id: привязка к автору; null — системная (общая) тема.
    Позволяет разграничивать личные и общие темы, делиться тестами.
    """
    __tablename__ = "learning_topics"

    topic_unique_identifier = Column(Integer, primary_key=True, index=True)
    topic_display_name = Column(String, nullable=False)
    topic_description_text = Column(String, nullable=True)
    topic_entropy_complexity_value = Column(Float, default=0.0)
    parent_topic_reference_identifier = Column(
        Integer,
        ForeignKey("learning_topics.topic_unique_identifier"),
        nullable=True,
    )
    topic_owner_user_id = Column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        nullable=True,
    )
    subtopics = relationship(
        "LearningTopicModel",
        backref="parent_topic",
        remote_side=[topic_unique_identifier],
    )
    topic_owner = relationship("UserAccountModel", back_populates="owned_learning_topics")
