import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Переход на PostgreSQL: полная поддержка ACID, надёжная аналитика
# для расчётов энтропии тем, когнитивной энергии и Индекса Готовности
PRODUCTION_POSTGRES_DATABASE_CONNECTION_URL = (
    "postgresql://username:password@localhost:5432/database_name"
)
# Локальная разработка: SQLite, если DATABASE_URL не задан
LOCAL_SQLITE_DATABASE_CONNECTION_URL = "sqlite:///./platform_database.db"

effective_database_url = os.getenv(
    "DATABASE_URL", LOCAL_SQLITE_DATABASE_CONNECTION_URL
)
is_sqlite = effective_database_url.startswith("sqlite")

# SQLite требует check_same_thread; для Postgres этот аргумент не нужен
platform_database_engine = create_engine(
    effective_database_url,
    connect_args={"check_same_thread": False} if is_sqlite else {}
)

# Создание фабрики сессий для взаимодействия с базой данных
database_session_local_factory = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=platform_database_engine
)

# Базовый класс для всех моделей данных в приложении
Base_Model_Declarative_Root = declarative_base()

def get_database_session_generator():
    """
    Генератор для получения сессии базы данных.
    Используется в FastAPI как зависимость (Dependency Injection).
    """
    active_database_session = database_session_local_factory()
    try:
        yield active_database_session
    finally:
        # Обязательное закрытие сессии после выполнения запроса
        active_database_session.close()