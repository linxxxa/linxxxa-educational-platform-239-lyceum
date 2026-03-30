"""
Дополнения схемы БД для существующих инсталляций (create_all не меняет таблицы).

Старые SQLite без колонок parent_subject_reference_id и
is_public_visibility ломали INSERT при сохранении колоды.
"""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.database import is_sqlite


def apply_learning_topics_schema_patch(engine: Engine) -> None:
    """Добавляет в learning_topics колонки контент-модуля, если их ещё нет."""
    try:
        insp = inspect(engine)
        if not insp.has_table("learning_topics"):
            return
    except Exception:
        return

    col_names = {c["name"] for c in insp.get_columns("learning_topics")}

    with engine.begin() as conn:
        if "parent_subject_reference_id" not in col_names:
            conn.execute(
                text(
                    "ALTER TABLE learning_topics "
                    "ADD COLUMN parent_subject_reference_id INTEGER"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS "
                    "ix_learning_topics_parent_subject_reference_id "
                    "ON learning_topics (parent_subject_reference_id)"
                )
            )

        if "is_public_visibility" not in col_names:
            default = "DEFAULT 1" if is_sqlite else "DEFAULT TRUE"
            ddl = (
                f"ALTER TABLE learning_topics ADD COLUMN "
                f"is_public_visibility BOOLEAN NOT NULL {default}"
            )
            conn.execute(text(ddl))


def apply_learning_cards_schema_patch(engine: Engine) -> None:
    """Удаляет поле сложности карточки (difficulty_level) из `learning_cards`.

    Расчёты энергии/интервалов теперь опираются только на динамику
    взаимодействия и энтропию темы.
    """
    try:
        insp = inspect(engine)
        if not insp.has_table("learning_cards"):
            return
    except Exception:
        return

    col_names = {c["name"] for c in insp.get_columns("learning_cards")}
    if "difficulty_level" not in col_names:
        return

    with engine.begin() as conn:
        if is_sqlite:
            # SQLite не поддерживает DROP COLUMN; делаем пересоздание таблицы.
            conn.execute(text("PRAGMA foreign_keys=off"))

            conn.execute(
                text(
                    """
                    CREATE TABLE learning_cards_new (
                        card_unique_identifier INTEGER NOT NULL,
                        owner_user_account_id INTEGER NOT NULL,
                        parent_topic_reference_id INTEGER NOT NULL,
                        card_question_text_payload TEXT NOT NULL,
                        card_answer_text_payload TEXT NOT NULL,
                        card_type VARCHAR(7) NOT NULL,
                        card_easiness_factor_ef FLOAT,
                        card_repetition_sequence_number INTEGER,
                        card_next_review_datetime DATETIME,
                        card_last_interval_days INTEGER,
                        PRIMARY KEY (card_unique_identifier),
                        FOREIGN KEY(owner_user_account_id) REFERENCES user_accounts
                        (user_unique_identifier),
                        FOREIGN KEY(parent_topic_reference_id) REFERENCES learning_topics
                        (topic_unique_identifier)
                    )
                    """
                )
            )

            conn.execute(
                text(
                    """
                    INSERT INTO learning_cards_new (
                        card_unique_identifier,
                        owner_user_account_id,
                        parent_topic_reference_id,
                        card_question_text_payload,
                        card_answer_text_payload,
                        card_type,
                        card_easiness_factor_ef,
                        card_repetition_sequence_number,
                        card_next_review_datetime,
                        card_last_interval_days
                    )
                    SELECT
                        card_unique_identifier,
                        owner_user_account_id,
                        parent_topic_reference_id,
                        card_question_text_payload,
                        card_answer_text_payload,
                        card_type,
                        card_easiness_factor_ef,
                        card_repetition_sequence_number,
                        card_next_review_datetime,
                        card_last_interval_days
                    FROM learning_cards
                    """
                )
            )

            conn.execute(text("DROP TABLE learning_cards"))
            conn.execute(
                text(
                    "ALTER TABLE learning_cards_new RENAME TO "
                    "learning_cards"
                )
            )

            conn.execute(text("PRAGMA foreign_keys=on"))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS "
                    "ix_learning_cards_card_unique_identifier "
                    "ON learning_cards (card_unique_identifier)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS "
                    "ix_learning_cards_parent_topic_reference_id "
                    "ON learning_cards (parent_topic_reference_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS "
                    "ix_learning_cards_card_next_review_datetime "
                    "ON learning_cards (card_next_review_datetime)"
                )
            )
        else:
            conn.execute(
                text(
                    "ALTER TABLE learning_cards DROP COLUMN "
                    "difficulty_level"
                )
            )


def apply_learning_topics_knowledge_level_patch(engine: Engine) -> None:
    """Добавляет learning_topics.topic_knowledge_level_0_100 (0–100)."""
    try:
        insp = inspect(engine)
        if not insp.has_table("learning_topics"):
            return
    except Exception:
        return

    col_names = {c["name"] for c in insp.get_columns("learning_topics")}
    if "topic_knowledge_level_0_100" in col_names:
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE learning_topics "
                "ADD COLUMN topic_knowledge_level_0_100 FLOAT DEFAULT 50.0"
            )
        )


def apply_progress_last_quality_q_schema_patch(engine: Engine) -> None:
    """Добавляет progress.progress_last_quality_q для сортировки очереди (last Q)."""
    try:
        insp = inspect(engine)
        if not insp.has_table("progress"):
            return
    except Exception:
        return

    col_names = {c["name"] for c in insp.get_columns("progress")}
    if "progress_last_quality_q" in col_names:
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE progress ADD COLUMN progress_last_quality_q INTEGER"
            )
        )
