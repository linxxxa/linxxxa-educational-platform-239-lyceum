-- Миграция: поддержка Data Flow (cascade, indexes, analytics)
-- Выполнить на существующей БД

-- 1. Composite index для быстрой выборки карточек на сегодня (user_id + next_review_date)
CREATE INDEX IF NOT EXISTS ix_progress_user_id_next_review_date
ON progress (progress_owner_user_account_id, progress_next_review_date);

-- 2. Колонка last_calculated_readiness_index_ri в user_accounts
ALTER TABLE user_accounts ADD COLUMN last_calculated_readiness_index_ri REAL;

-- 3. Interaction.card_id: SET NULL при удалении карточки (сохранение логов)
-- SQLite не поддерживает ALTER CONSTRAINT. Для PostgreSQL:
-- ALTER TABLE interactions DROP CONSTRAINT interactions_interaction_target_card_unique_identifier_fkey;
-- ALTER TABLE interactions ADD CONSTRAINT ... ON DELETE SET NULL;
-- Для SQLite: требуется пересоздание таблицы или оставить без изменений.
