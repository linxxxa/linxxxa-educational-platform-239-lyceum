"""
Предмет обучения (Subjects). Связь One-to-Many с темами (колодами).

Идентификаторы — Integer (как во всём 239-стеке: карточки, progress, study),
чтобы не ломать FK и SM-2.
"""
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base_Model_Declarative_Root


class LearningSubjectModel(Base_Model_Declarative_Root):
    __tablename__ = "learning_subjects"

    subject_unique_identifier = Column(Integer, primary_key=True, index=True)
    subject_display_name = Column(String(255), nullable=False)
    subject_description_text = Column(Text, nullable=True)
    created_by_user_id = Column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        nullable=False,
        index=True,
    )

    subject_creator = relationship(
        "UserAccountModel",
        back_populates="owned_learning_subjects",
    )
    child_topics = relationship(
        "LearningTopicModel",
        back_populates="parent_subject",
    )
