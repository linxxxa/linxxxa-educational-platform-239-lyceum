from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.orm import relationship

from app.database import Base_Model_Declarative_Root


class UserAccountModel(Base_Model_Declarative_Root):
    """
    Класс, описывающий таблицу пользователей в базе данных.
    Содержит поля для авторизации и метрики адаптивного обучения.
    """
    __tablename__ = "user_accounts"

    # Основные идентификационные данные
    user_unique_identifier = Column(Integer, primary_key=True, index=True)
    user_full_display_name = Column(String, nullable=False)
    user_email_address = Column(String, unique=True, index=True, nullable=False)
    user_hashed_password_string = Column(String, nullable=False)

    # Метрики адаптивного обучения (из раздела 3 твоего ТЗ)
    current_cognitive_energy_level = Column(Float, default=100.0)  # Переменная E
    global_mastery_coefficient = Column(Float, default=0.0)        # Параметр M
    personal_forgetting_rate_lambda = Column(Float, default=0.1)   # Коэффициент λi
    
    # Статистика для Индекса Готовности (RI)
    average_response_time_seconds = Column(Float, default=0.0)     # Параметр τ
    knowledge_deviation_sigma = Column(Float, default=0.0)         # Параметр σ

    owned_learning_topics = relationship(
        "LearningTopicModel", back_populates="topic_owner"
    )