"""
Сервис агрегации глобальной статистики пользователя.

Агрегирует данные из таблиц LearningInteractions (interactions) и
UserCardProgress (progress) для обновления total_learning_hours и
last_calculated_readiness_index_ri в таблице UserAccounts (user_accounts).
"""
from __future__ import annotations

import logging
import math
import statistics
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models.learning_card import LearningCardModel
from app.models.learning_interaction import (
    LearningInteractionsModel,
    UserSubjectiveConfidenceLevelEnum,
)
from app.models.learning_topic import LearningTopicModel
from app.models.user_account import UserAccountModel
from app.models.user_card_progress import UserCardProgressModel
from app.services.math_metrics import (
    calculate_readiness_index,
    interaction_efficiency_percent,
    theme_mastery_weighted_percent,
)

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


def refresh_user_global_stats(
    database_session_instance: Session,
    target_user_account_identifier: int,
) -> bool:
    """
    Агрегирует данные из Interactions и Progress для обновления
    total_learning_hours и readiness_index_ri в UserAccounts.

    Затрагиваемые таблицы:
    - interactions (чтение): sum(response_time_ms) для total_hours
    - progress (чтение): avg(mastery_level) по темам для RI
    - learning_cards (чтение): JOIN для группировки по parent_topic
    - user_accounts (запись): total_learning_hours, last_calculated_readiness_index_ri,
      global_mastery_coefficient, knowledge_deviation_sigma

    Возвращает True при успешном обновлении, False если пользователь не найден.
    """
    user_record = database_session_instance.execute(
        select(UserAccountModel).where(
            UserAccountModel.user_unique_identifier
            == target_user_account_identifier
        )
    ).scalars().first()
    if user_record is None:
        logger.warning(
            "refresh_user_global_stats: пользователь %s не найден",
            target_user_account_identifier,
        )
        return False

    total_hours_value = _aggregate_total_learning_hours_from_interactions(
        database_session_instance,
        target_user_account_identifier,
    )
    (
        mastery_levels_list,
        global_mastery_average_value,
        knowledge_deviation_sigma_value,
    ) = _aggregate_mastery_stats_from_progress(
        database_session_instance,
        target_user_account_identifier,
    )
    calculated_readiness_index_ri_value = calculate_readiness_index(
        mastery_levels=mastery_levels_list,
        total_hours=total_hours_value,
    )

    user_record.total_learning_hours = float(total_hours_value)
    user_record.last_calculated_readiness_index_ri = float(
        calculated_readiness_index_ri_value
    )
    user_record.global_mastery_coefficient = float(global_mastery_average_value)
    user_record.knowledge_deviation_sigma = float(knowledge_deviation_sigma_value)
    database_session_instance.add(user_record)
    database_session_instance.commit()

    logger.info(
        "refresh_user_global_stats: user=%s, total_hours=%.4f, ri=%.2f",
        target_user_account_identifier,
        total_hours_value,
        calculated_readiness_index_ri_value,
    )
    return True


def _aggregate_total_learning_hours_from_interactions(
    database_session_instance: Session,
    target_user_account_identifier: int,
) -> float:
    """
    Суммирует response_time_ms из user_interaction_history_log (interactions)
    и конвертирует в часы.
    """
    sum_result = database_session_instance.execute(
        select(
            func.coalesce(
                func.sum(
                    LearningInteractionsModel.interaction_response_time_ms
                ),
                0,
            )
        ).where(
            LearningInteractionsModel.interaction_owner_user_account_id
            == target_user_account_identifier
        )
    ).scalar() or 0
    total_response_time_ms = int(sum_result)
    return float(total_response_time_ms) / 3600000.0


def _aggregate_mastery_stats_from_progress(
    database_session_instance: Session,
    target_user_account_identifier: int,
) -> tuple[list[float], float, float]:
    """
    Агрегирует mastery_level по темам из progress.
    Возвращает (mastery_levels_list, avg, std).
    """
    mastery_query = database_session_instance.execute(
        select(func.avg(UserCardProgressModel.progress_mastery_level))
        .select_from(UserCardProgressModel)
        .join(
            LearningCardModel,
            UserCardProgressModel.progress_target_card_unique_identifier
            == LearningCardModel.card_unique_identifier,
        )
        .group_by(LearningCardModel.parent_topic_reference_id)
        .where(
            UserCardProgressModel.progress_owner_user_account_id
            == target_user_account_identifier
        )
    )
    mastery_rows = mastery_query.all()
    mastery_levels_list = [
        float(row[0])
        for row in mastery_rows
        if row[0] is not None
    ]
    if not mastery_levels_list:
        return [], 0.0, 0.0
    global_mastery_average = sum(mastery_levels_list) / len(mastery_levels_list)
    deviation_sigma = (
        statistics.pstdev(mastery_levels_list)
        if len(mastery_levels_list) > 1
        else 0.0
    )
    return mastery_levels_list, global_mastery_average, deviation_sigma


def _q_discrete_from_interaction_row(
    row: LearningInteractionsModel,
) -> int:
    """Q для верных: 5/4/3 по уровню уверенности."""
    if not row.interaction_is_correct:
        return 0
    lev = row.interaction_subjective_confidence_level
    if lev == UserSubjectiveConfidenceLevelEnum.easy:
        return 5
    if lev == UserSubjectiveConfidenceLevelEnum.medium:
        return 4
    return 3


def interaction_efficiency_from_interaction_row(
    row: LearningInteractionsModel,
) -> float:
    """Эффективность по одной записи лога (см. interaction_efficiency_percent)."""
    q = _q_discrete_from_interaction_row(row)
    return interaction_efficiency_percent(row.interaction_is_correct, q)


def learning_efficiency_dashboard_display(
    database_session_instance: Session,
    user_id: int,
) -> float:
    """
    Эффективность для дашборда: среднее за последние 7 дней.
    Если за неделю не было ответов — затухание от среднего по истории.
    """
    now = datetime.utcnow()
    since_7d = now - timedelta(days=7)
    rows_7d = list(
        database_session_instance.execute(
            select(LearningInteractionsModel).where(
                LearningInteractionsModel.interaction_owner_user_account_id
                == user_id,
                LearningInteractionsModel.interaction_timestamp.isnot(None),
                LearningInteractionsModel.interaction_timestamp >= since_7d,
            )
        ).scalars().all()
    )
    if rows_7d:
        vals = [interaction_efficiency_from_interaction_row(r) for r in rows_7d]
        return float(sum(vals) / len(vals))

    last_ts = database_session_instance.execute(
        select(func.max(LearningInteractionsModel.interaction_timestamp)).where(
            LearningInteractionsModel.interaction_owner_user_account_id == user_id,
            LearningInteractionsModel.interaction_timestamp.isnot(None),
        )
    ).scalar()
    if last_ts is None:
        return 0.0

    all_rows = list(
        database_session_instance.execute(
            select(LearningInteractionsModel)
            .where(
                LearningInteractionsModel.interaction_owner_user_account_id
                == user_id,
            )
            .limit(8000)
        ).scalars().all()
    )
    if not all_rows:
        return 0.0
    baseline = sum(
        interaction_efficiency_from_interaction_row(r) for r in all_rows
    ) / float(len(all_rows))
    idle_days = (now - last_ts).days
    if idle_days <= 7:
        return float(max(0.0, min(100.0, baseline)))
    decay = math.exp(-0.012 * float(max(0, idle_days - 7)))
    return float(max(0.0, min(100.0, baseline * decay)))


def session_learning_efficiency_percent_since(
    database_session_instance: Session,
    user_id: int,
    since_timestamp: datetime,
) -> float:
    """Средняя эффективность ответов с момента since_timestamp (текущая сессия)."""
    rows = list(
        database_session_instance.execute(
            select(LearningInteractionsModel).where(
                LearningInteractionsModel.interaction_owner_user_account_id
                == user_id,
                LearningInteractionsModel.interaction_timestamp.isnot(None),
                LearningInteractionsModel.interaction_timestamp >= since_timestamp,
            )
        ).scalars().all()
    )
    if not rows:
        return 0.0
    vals = [interaction_efficiency_from_interaction_row(r) for r in rows]
    return float(sum(vals) / len(vals))


def recalculate_topic_knowledge_level_for_owner(
    database_session_instance: Session,
    owner_user_id: int,
    topic_unique_identifier: int,
) -> tuple[float, bool]:
    """
    Пересчитывает topic_knowledge_level_0_100 по весам карточек и last Q.

    Возвращает (уровень 0–100, есть ли хотя бы одна карточка с записью прогресса).
    """
    qrows = database_session_instance.execute(
        select(
            LearningCardModel.card_unique_identifier,
            UserCardProgressModel.progress_last_quality_q,
        )
        .select_from(LearningCardModel)
        .outerjoin(
            UserCardProgressModel,
            and_(
                UserCardProgressModel.progress_target_card_unique_identifier
                == LearningCardModel.card_unique_identifier,
                UserCardProgressModel.progress_owner_user_account_id
                == owner_user_id,
            ),
        )
        .where(
            LearningCardModel.parent_topic_reference_id
            == int(topic_unique_identifier),
            LearningCardModel.owner_user_account_id == int(owner_user_id),
        )
        .order_by(LearningCardModel.card_unique_identifier.asc())
    ).all()
    last_qs: list[int | None] = [
        int(r[1]) if r[1] is not None else None for r in qrows
    ]
    val = theme_mastery_weighted_percent(last_qs)
    has_any_progress = any(x is not None for x in last_qs)
    topic = database_session_instance.get(
        LearningTopicModel, int(topic_unique_identifier)
    )
    if topic is not None and int(topic.topic_owner_user_id or 0) == int(
        owner_user_id
    ):
        topic.topic_knowledge_level_0_100 = val
        database_session_instance.add(topic)
    return val, has_any_progress


def sync_all_topic_knowledge_levels_for_user(
    database_session_instance: Session,
    user_id: int,
) -> None:
    """Пересчитывает уровень освоения для всех тем пользователя (веса+Q)."""
    tids = database_session_instance.execute(
        select(LearningTopicModel.topic_unique_identifier).where(
            LearningTopicModel.topic_owner_user_id == user_id
        )
    ).scalars().all()
    for tid in tids:
        recalculate_topic_knowledge_level_for_owner(
            database_session_instance, user_id, int(tid)
        )


def average_topic_knowledge_level_0_100(
    database_session_instance: Session,
    user_id: int,
) -> float:
    """Средний уровень освоения по темам пользователя (0–100), по полю темы."""
    rows = (
        database_session_instance.execute(
            select(LearningTopicModel.topic_knowledge_level_0_100).where(
                LearningTopicModel.topic_owner_user_id == user_id,
            )
        )
        .scalars()
        .all()
    )
    vals = [float(v) if v is not None else 0.0 for v in rows]
    if not vals:
        return 0.0
    return float(sum(vals) / len(vals))

