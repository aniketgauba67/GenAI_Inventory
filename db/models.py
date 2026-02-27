"""SQLAlchemy ORM models for Pantry and Inventory Items"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Pantry(Base):
    """Pantry table - represents a physical pantry location"""
    __tablename__ = "pantries"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to inventory items
    items = relationship("InventoryItem", back_populates="pantry", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Pantry(id={self.id}, name='{self.name}')>"


class InventoryItem(Base):
    """InventoryItem table - represents individual items in a pantry"""
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    pantry_id = Column(Integer, ForeignKey("pantries.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String(255), nullable=False)
    original_quantity = Column(Integer, nullable=False)
    current_quantity = Column(Integer, nullable=False)
    status = Column(String(50), default="normal")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship back to pantry
    pantry = relationship("Pantry", back_populates="items")

    def __repr__(self):
        return f"<InventoryItem(id={self.id}, item_name='{self.item_name}', current_qty={self.current_quantity})>"

    def update_quantity(self, new_quantity: int):
        """Update current quantity and automatically set status"""
        self.current_quantity = new_quantity
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
