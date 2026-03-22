-- Миграция: добавление индексов согласно аудиту ИП
-- Выполнить на существующей БД для ускорения запросов

-- Индекс для частых JOIN Cards → Topics (фильтрация карточек по теме)
CREATE INDEX IF NOT EXISTS ix_learning_cards_parent_topic_reference_id
ON learning_cards (parent_topic_reference_id);

-- Индекс для фильтрации тем по владельцу
CREATE INDEX IF NOT EXISTS ix_learning_topics_topic_owner_user_id
ON learning_topics (topic_owner_user_id);
