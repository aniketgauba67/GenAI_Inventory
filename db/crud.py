"""Example usage of SQLAlchemy ORM for pantry inventory"""

from database import SessionLocal
from models import Pantry, InventoryItem


def add_pantry(name: str, location: str = None) -> Pantry:
    """Add a new pantry"""
    db = SessionLocal()
    try:
        pantry = Pantry(name=name, location=location)
        db.add(pantry)
        db.commit()
        db.refresh(pantry)
        print(f"✓ Created pantry: {pantry}")
        return pantry
    except Exception as e:
        db.rollback()
        print(f"✗ Error creating pantry: {e}")
        raise
    finally:
        db.close()


def add_item(pantry_id: int, item_name: str, quantity: int) -> InventoryItem:
    """Add a new item to a pantry"""
    db = SessionLocal()
    try:
        item = InventoryItem(
            pantry_id=pantry_id,
            item_name=item_name,
            original_quantity=quantity,
            current_quantity=quantity
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        print(f"✓ Added item: {item}")
        return item
    except Exception as e:
        db.rollback()
        print(f"✗ Error adding item: {e}")
        raise
    finally:
        db.close()


def update_quantity(item_id: int, new_quantity: int) -> InventoryItem:
    """Update item quantity and status"""
    db = SessionLocal()
    try:
        item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
        if item:
            item.update_quantity(new_quantity)
            db.commit()
            db.refresh(item)
            print(f"✓ Updated item: {item} - Status: {item.status}")
            return item
        else:
            print(f"✗ Item {item_id} not found")
            return None
    except Exception as e:
        db.rollback()
        print(f"✗ Error updating item: {e}")
        raise
    finally:
        db.close()


def get_pantry_items(pantry_id: int) -> list:
    """Get all items in a pantry"""
    db = SessionLocal()
    try:
        pantry = db.query(Pantry).filter(Pantry.id == pantry_id).first()
        if pantry:
            print(f"\n📦 Pantry: {pantry.name} ({pantry.location})")
            print("-" * 50)
            for item in pantry.items:
                print(f"  {item.item_name}: {item.current_quantity}/{item.original_quantity} [{item.status}]")
            return pantry.items
        else:
            print(f"✗ Pantry {pantry_id} not found")
            return []
    except Exception as e:
        print(f"✗ Error fetching items: {e}")
        raise
    finally:
        db.close()


def get_all_pantries() -> list:
    """Get all pantries"""
    db = SessionLocal()
    try:
        pantries = db.query(Pantry).all()
        print(f"\n📍 Total Pantries: {len(pantries)}")
        for pantry in pantries:
            print(f"  - {pantry.name} (ID: {pantry.id}, Items: {len(pantry.items)})")
        return pantries
    except Exception as e:
        print(f"✗ Error fetching pantries: {e}")
        raise
    finally:
        db.close()

def delete_all_data():
    """Delete all pantries and items (for testing purposes)"""
    db = SessionLocal()
    try:
        num_items_deleted = db.query(InventoryItem).delete()
        num_pantries_deleted = db.query(Pantry).delete()
        db.commit()
        print(f"✓ Deleted {num_pantries_deleted} pantries and {num_items_deleted} items")
    except Exception as e:
        db.rollback()
        print(f"✗ Error deleting data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # Example usage
    print("=== Pantry Inventory Management ===\n")
    delete_all_data()  # Clear any existing data


    # Add pantries
    pantry1 = add_pantry("Kitchen Pantry", "Main Kitchen")
    pantry2 = add_pantry("Storage Room", "Basement")
    
    # Add items
    add_item(pantry1.id, "Rice", 10)
    add_item(pantry1.id, "Flour", 5)
    add_item(pantry2.id, "Canned Beans", 20)
    
    # Update quantities
    update_quantity(1, 3)  # Rice down to 3 (low status)
    update_quantity(2, 0)  # Flour out (out status)
    
    # Get all pantries
    get_all_pantries()

    # Get items in all pantries
    for pantry in get_all_pantries():
        get_pantry_items(pantry.id)
    
    # Get items in specific pantry
    get_pantry_items(pantry1.id)
