"""Persistence model for Sprint 1 inventory processing runs."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String

from database import Base


class InventoryRun(Base):
    """Store one processed inventory run and its derived artifacts."""

    __tablename__ = "inventory_runs"

    run_id = Column(String(36), primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ok = Column(Boolean, nullable=False)
    count = Column(Integer, nullable=False)
    files = Column(JSON, nullable=False)
    inventory = Column(JSON, nullable=False)
    classification = Column(JSON, nullable=False)
    summary_counts = Column(JSON, nullable=False)
    comparison = Column(JSON, nullable=True)
    stage = Column(String(50), nullable=True)
