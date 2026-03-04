"""SQLAlchemy ORM models for Pantry and Inventory Items"""

from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from database import Base
from sqlalchemy.dialects.postgresql import JSONB



class Pantry(Base):
    """Pantry table - represents a physical pantry location"""
    __tablename__ = "pantries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_pantries_name", "name"),
    )

    # Relationship to inventory items
    items = relationship("InventoryItem", back_populates="pantry", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Pantry(id={self.id}, name='{self.name}')>"


class InventoryItem(Base):
    """InventoryItem table - represents categories of items in a pantry"""
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    pantry_id = Column(Integer, ForeignKey("pantries.id", ondelete="CASCADE"), nullable=False, index=True)
    category_name = Column(String(255), nullable=False)
    original_quantity = Column(Integer, nullable=False)
    status = Column(String(50), default="normal")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("original_quantity >= 0", name="ck_inventory_items_original_quantity_nonnegative"),
        Index("ix_inventory_items_pantry_category", "pantry_id", "category_name"),
        Index("ix_inventory_items_status", "status"),
    )

    # Relationship back to pantry
    pantry = relationship("Pantry", back_populates="items")

    def __repr__(self):
        return f"<InventoryItem(id={self.id}, category_name='{self.category_name}', original_qty={self.original_quantity}, status='{self.status}')>"

    def update_status(self, new_quantity: int):
        """Automatically set status"""
        self.updated_at = datetime.utcnow()
        
        # Set status based on quantity
        if new_quantity == 0:
            self.status = "out"
        elif new_quantity < self.original_quantity * 0.25:
            self.status = "critical"
        elif new_quantity < self.original_quantity * 0.5:
            self.status = "low"
        else:
            self.status = "normal"

class InventoryRun(Base):
    """Store one processed inventory run and its derived artifacts."""

    __tablename__ = "inventory_runs"

    run_id = Column(String(36), primary_key=True, index=True)
    pantry_id = Column(Integer, ForeignKey("pantries.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    files = Column(JSONB, nullable=True)
    inventory = Column(JSONB, nullable=False)
    comparison = Column(JSONB, nullable=True)
    source = Column(String(50), nullable=True)

    __table_args__ = (
        Index("ix_inventory_runs_pantry_created_at", "pantry_id", "created_at"),
    )