"""Example usage of SQLAlchemy ORM for pantry inventory"""
from datetime import datetime, timedelta
from sqlalchemy import text
from database import SessionLocal
from models import Pantry, InventoryItem, LoginCredentials
from password_utils import hash_password, verify_password



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

def get_pantry_id_by_name(name: str) -> int:
    """Get pantry ID by name"""
    db = SessionLocal()
    try:
        pantry = db.query(Pantry).filter(Pantry.name == name).first()
        if pantry:
            print(f"✓ Found pantry: {pantry}")
            return pantry.id
        else:
            print(f"✗ Pantry '{name}' not found")
            return None
    except Exception as e:
        print(f"✗ Error fetching pantry: {e}")
        raise
    finally:
        db.close()

def add_items(pantry_id: int, category_name: str, quantity: int) -> InventoryItem:
    """Add a new item to a pantry"""
    db = SessionLocal()
    try:
        item = InventoryItem(
            pantry_id=pantry_id,
            category_name=category_name,
            original_quantity=quantity
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


def update_status(item_id: int, new_quantity: int) -> InventoryItem:
    """Update category status"""
    db = SessionLocal()
    try:
        item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
        if item:
            item.update_status(new_quantity)
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
                print(f"  {item.category_name}: {item.original_quantity} [{item.status}]")
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
        # reset auto-incrementing IDs (PostgreSQL specific)
        db.execute(text("ALTER SEQUENCE pantries_id_seq RESTART WITH 1;"))
        db.execute(text("ALTER SEQUENCE inventory_items_id_seq RESTART WITH 1;"))
        
        db.commit()
        print(f"✓ Deleted {num_pantries_deleted} pantries and {num_items_deleted} items")
    except Exception as e:
        db.rollback()
        print(f"✗ Error deleting data: {e}")
        raise
    finally:
        db.close()


# === Credentials Functions ===

def set_login_credentials(pantry_id: int, password_raw: str) -> LoginCredentials:
    """Create or update login credentials for a pantry. 
    Note: password_hash should be already hashed using bcrypt or similar before passing to this function.
    """
    db = SessionLocal()
    try:
        password_hash = hash_password(password_raw) 
        # Check if credentials already exist for this pantry
        credentials = db.query(LoginCredentials).filter(LoginCredentials.pantry_id == pantry_id).first()
        
        if credentials:
            # Update existing credentials
            credentials.password_hash = password_hash
            print(f"✓ Updated login credentials for pantry ID: {pantry_id}")
        else:
            # Create new credentials
            credentials = LoginCredentials(
                pantry_id=pantry_id,
                password_hash=password_hash
            )
            db.add(credentials)
            print(f"✓ Created login credentials for pantry ID: {pantry_id}")
        
        db.commit()
        db.refresh(credentials)
        return credentials
    except Exception as e:
        db.rollback()
        print(f"✗ Error setting login credentials: {e}")
        raise
    finally:
        db.close()


def check_credentials(pantry_id: int, password_raw: str) -> bool:
    """Check if the provided password is correct for the given pantry ID"""
    db = SessionLocal()
    try:
        credentials = db.query(LoginCredentials).filter(LoginCredentials.pantry_id == pantry_id).first()
        if credentials:
            print(f"✓ Found login credentials for pantry ID: {pantry_id}")
            if verify_password(password_raw, credentials.password_hash):
                print(f"✓ Password hash matches for pantry ID: {pantry_id}")
                return True
            else: 
                print(f"✗ Password hash does NOT match for pantry ID: {pantry_id}")
                return False
        else:
            print(f"✗ No login credentials found for pantry ID: {pantry_id}")
            return False
    except Exception as e:
        print(f"✗ Error fetching login credentials: {e}")
        raise
    finally:
        db.close()


def delete_login_credentials(pantry_id: int) -> bool:
    """Delete login credentials for a specific pantry"""
    db = SessionLocal()
    try:
        credentials = db.query(LoginCredentials).filter(LoginCredentials.pantry_id == pantry_id).first()
        if credentials:
            db.delete(credentials)
            db.commit()
            print(f"✓ Deleted login credentials for pantry ID: {pantry_id}")
            return True
        else:
            print(f"✗ No login credentials found for pantry ID: {pantry_id}")
            return False
    except Exception as e:
        db.rollback()
        print(f"✗ Error deleting login credentials: {e}")
        raise
    finally:
        db.close()




if __name__ == "__main__":
    # Credentials demo
    print("\n=== Manager Credentials Demo ===\n")
    set_login_credentials(1, "hashed_password_example")
    is_valid = check_credentials(1, "hashed_password_example")
    print(f"✓ Credentials valid: {is_valid}")
    delete_login_credentials(1)
    
