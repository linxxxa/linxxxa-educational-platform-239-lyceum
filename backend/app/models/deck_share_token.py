"""Токен приглашения забрать колоду по ссылке из письма."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.database import Base_Model_Declarative_Root


class DeckShareTokenModel(Base_Model_Declarative_Root):
    __tablename__ = "deck_share_tokens"

    share_token = Column(String(64), primary_key=True, index=True)
    source_topic_unique_identifier = Column(
        Integer,
        ForeignKey("learning_topics.topic_unique_identifier"),
        nullable=False,
        index=True,
    )
    sharer_user_account_id = Column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        nullable=False,
    )
    recipient_email_normalized = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    recipient_user_account_id = Column(
        Integer,
        ForeignKey("user_accounts.user_unique_identifier"),
        nullable=True,
    )
    cloned_topic_unique_identifier = Column(
        Integer,
        ForeignKey("learning_topics.topic_unique_identifier"),
        nullable=True,
    )
