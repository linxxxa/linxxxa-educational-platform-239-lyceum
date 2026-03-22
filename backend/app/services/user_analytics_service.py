"""
Сервис агрегации глобальной статистики пользователя.

Агрегирует данные из таблиц LearningInteractions (interactions) и
UserCardProgress (progress) для обновления total_learning_hours и
last_calculated_readiness_index_ri в таблице UserAccounts (user_accounts).
"""
from __future__ import annotations

import logging
import statistics
from typing import TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.learning_card import LearningCardModel
from app.models.learning_interaction import LearningInteractionsModel
from app.models.user_account import UserAccountModel
from app.models.user_card_progress import UserCardProgressModel
from app.services.math_metrics import calculate_readiness_index

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
