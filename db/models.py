"""SQLAlchemy ORM models for pantry, inventory item, and run history tables."""

from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from database import Base
from sqlalchemy.dialects.postgresql import JSONB



class Pantry(Base):
    """Pantry table - represents one physical pantry location."""
    __tablename__ = "pantries"

    # Stable pantry identifier used by upload, warehouse import, and volunteer submit flows.
    id = Column(Integer, primary_key=True, index=True)
    # Human-readable pantry name used in admin/debug flows.
    name = Column(String(100), nullable=False)
    # Optional location text for operators.
    location = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_pantries_name", "name"),
    )

    # One pantry owns many configured inventory-item rows.
    items = relationship("InventoryItem", back_populates="pantry", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Pantry(id={self.id}, name='{self.name}')>"


class InventoryItem(Base):
    """InventoryItem table - keeps pantry category rows from the original project model."""
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    pantry_id = Column(Integer, ForeignKey("pantries.id", ondelete="CASCADE"), nullable=False, index=True)
    category_name = Column(String(255), nullable=False)
    # Original configured quantity retained from the existing schema.
    original_quantity = Column(Integer, nullable=False)
    # Legacy status field retained for compatibility with the original code.
    status = Column(String(50), default="normal")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        # Pantry configuration quantities should never be negative.
        CheckConstraint("original_quantity >= 0", name="ck_inventory_items_original_quantity_nonnegative"),
        Index("ix_inventory_items_pantry_category", "pantry_id", "category_name"),
        Index("ix_inventory_items_status", "status"),
    )

    # Relationship back to pantry.
    pantry = relationship("Pantry", back_populates="items")

    def __repr__(self):
        return f"<InventoryItem(id={self.id}, category_name='{self.category_name}', original_qty={self.original_quantity}, status='{self.status}')>"

    def update_status(self, new_quantity: int):
        """Automatically set the legacy status field from a new quantity value."""
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
    """Store one inventory event in the unified run-history table.

    The current schema stores both:
    - warehouse imports with `source="warehouse-snapshot"`
    - volunteer pantry submissions with `source="volunteer-submit"`

    The current stock numbers live in `inventory`.
    Any derived context such as warehouse references, ratios, levels, and summary counts
    is stored inside `comparison`.
    """

    __tablename__ = "inventory_runs"

    # Unique id for one stored run.
    run_id = Column(String(36), primary_key=True, index=True)
    # Pantry this run belongs to.
    pantry_id = Column(Integer, ForeignKey("pantries.id", ondelete="CASCADE"), nullable=False, index=True)
    # Timestamp used to find the latest warehouse import or volunteer submission.
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Optional file metadata from the upload/import that produced this run.
    files = Column(JSONB, nullable=True)
    # Stored inventory counts for the fixed 19 categories.
    inventory = Column(JSONB, nullable=False)
    # Derived comparison details such as warehouseRunId, ratios, levels, and summaryCounts.
    comparison = Column(JSONB, nullable=True)
    # Distinguishes the type of run: e.g. warehouse-snapshot or volunteer-submit.
    source = Column(String(50), nullable=True)

    __table_args__ = (
        Index("ix_inventory_runs_pantry_created_at", "pantry_id", "created_at"),
    )
