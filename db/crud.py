"""Example usage of SQLAlchemy ORM for pantry inventory"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy import text
from db.database import SessionLocal
from db.models import DirectorCredentials, InventoryItem, LoginCredentials, Pantry
from db.password_utils import hash_password, verify_password


TIMEZONE = ZoneInfo("America/New_York")
DAY_MAP = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}


def _time_to_minutes(value: str) -> int:
    hour_text, minute_text = value.split(":")
    return int(hour_text) * 60 + int(minute_text)


def _compute_current_open_state(hours: list[dict] | None) -> bool:
    if not isinstance(hours, list) or not hours:
        return False

    now = datetime.now(TIMEZONE)
    current_day = DAY_MAP[now.weekday()]
    current_minutes = now.hour * 60 + now.minute

    for slot in hours:
        if slot.get("day") != current_day:
            continue
        if _time_to_minutes(slot["open"]) <= current_minutes < _time_to_minutes(slot["close"]):
            return True
    return False



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


def get_pantry_credential_registry() -> list[dict]:
    """List pantries with whether a login credential has been configured."""
    db = SessionLocal()
    try:
        rows = (
            db.query(Pantry, LoginCredentials)
            .outerjoin(LoginCredentials, LoginCredentials.pantry_id == Pantry.id)
            .order_by(Pantry.id.asc())
            .all()
        )
        registry = []
        for pantry, credentials in rows:
            registry.append(
                {
                    "pantryId": str(pantry.id),
                    "name": pantry.name,
                    "location": pantry.location,
                    "hasCredentials": credentials is not None,
                    "isOpen": pantry.is_open,
                    "manualOverride": pantry.manual_override,
                    "operatingHours": pantry.operating_hours or [],
                }
            )
        print(f"✓ Loaded pantry credential registry for {len(registry)} pantries")
        return registry
    except Exception as e:
        print(f"✗ Error loading pantry credential registry: {e}")
        raise
    finally:
        db.close()


def toggle_pantry_status(pantry_id: int) -> dict | None:
    """Toggle the is_open flag and enable manual_override so the scheduler won't overwrite it."""
    db = SessionLocal()
    try:
        pantry = db.query(Pantry).filter(Pantry.id == pantry_id).first()
        if pantry is None:
            print(f"✗ Pantry {pantry_id} not found")
            return None
        pantry.is_open = not pantry.is_open
        pantry.manual_override = True
        db.commit()
        db.refresh(pantry)
        print(f"✓ Toggled pantry {pantry_id} is_open → {pantry.is_open} (manual_override=True)")
        return {"pantryId": str(pantry.id), "isOpen": pantry.is_open, "manualOverride": True}
    except Exception as e:
        db.rollback()
        print(f"✗ Error toggling pantry status: {e}")
        raise
    finally:
        db.close()


def set_pantry_status(pantry_id: int, is_open: bool) -> dict | None:
    """Explicitly set is_open and enable manual_override."""
    db = SessionLocal()
    try:
        pantry = db.query(Pantry).filter(Pantry.id == pantry_id).first()
        if pantry is None:
            print(f"✗ Pantry {pantry_id} not found")
            return None
        pantry.is_open = is_open
        pantry.manual_override = True
        db.commit()
        db.refresh(pantry)
        print(f"✓ Set pantry {pantry_id} is_open → {pantry.is_open} (manual_override=True)")
        return {"pantryId": str(pantry.id), "isOpen": pantry.is_open, "manualOverride": True}
    except Exception as e:
        db.rollback()
        print(f"✗ Error setting pantry status: {e}")
        raise
    finally:
        db.close()


def clear_manual_override(pantry_id: int) -> dict | None:
    """Clear manual_override and immediately re-evaluate the schedule."""
    db = SessionLocal()
    try:
        pantry = db.query(Pantry).filter(Pantry.id == pantry_id).first()
        if pantry is None:
            return None
        pantry.manual_override = False

        hours = pantry.operating_hours
        if isinstance(hours, list) and hours:
            pantry.is_open = _compute_current_open_state(hours)

        db.commit()
        db.refresh(pantry)
        print(f"✓ Cleared manual_override for pantry {pantry_id}, is_open → {pantry.is_open}")
        return {"pantryId": str(pantry.id), "isOpen": pantry.is_open, "manualOverride": False}
    except Exception as e:
        db.rollback()
        print(f"✗ Error clearing manual override: {e}")
        raise
    finally:
        db.close()


def update_pantry_operating_hours(pantry_id: int, operating_hours: list[dict]) -> dict | None:
    """Replace one pantry's weekly operating-hours schedule."""
    db = SessionLocal()
    try:
        pantry = db.query(Pantry).filter(Pantry.id == pantry_id).first()
        if pantry is None:
            return None

        normalized_hours = list(operating_hours) if operating_hours else []
        pantry.operating_hours = normalized_hours or None
        if not pantry.manual_override:
            pantry.is_open = _compute_current_open_state(normalized_hours)

        db.commit()
        db.refresh(pantry)
        print(f"✓ Updated operating hours for pantry {pantry_id}")
        return {
            "pantryId": str(pantry.id),
            "operatingHours": pantry.operating_hours or [],
            "isOpen": pantry.is_open,
            "manualOverride": pantry.manual_override,
        }
    except Exception as e:
        db.rollback()
        print(f"✗ Error updating operating hours: {e}")
        raise
    finally:
        db.close()


def update_pantry_metadata(
    pantry_id: int,
    name: str | None = None,
    location: str | None = None,
) -> Pantry | None:
    """Update pantry name/location fields when provided.

    Passing None for a field means "leave unchanged".
    """
    db = SessionLocal()
    try:
        pantry = db.query(Pantry).filter(Pantry.id == pantry_id).first()
        if pantry is None:
            print(f"✗ Pantry {pantry_id} not found")
            return None

        if name is not None:
            pantry.name = name
        if location is not None:
            pantry.location = location

        db.commit()
        db.refresh(pantry)
        print(f"✓ Updated pantry metadata for pantry ID: {pantry_id}")
        return pantry
    except Exception as e:
        db.rollback()
        print(f"✗ Error updating pantry metadata: {e}")
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

def set_director_credentials(email: str, password_raw: str):
    """Create or update director credentials. Note: password_raw should be hashed before passing."""
    # Similar implementation to set_login_credentials but for DirectorCredentials model
    db = SessionLocal()
    try:
        password_hash = hash_password(password_raw) 
        # Check if credentials already exist for this pantry
        credentials = db.query(DirectorCredentials).filter(DirectorCredentials.email == email).first()
        
        if credentials:
            # Update existing credentials
            credentials.password_hash = password_hash
            print(f"✓ Updated login credentials for director: {email}")
        else:
            # Create new credentials
            credentials = DirectorCredentials(
                email=email,
                password_hash=password_hash
            )
            db.add(credentials)
            print(f"✓ Created login credentials for director: {email}")
        
        db.commit()
        db.refresh(credentials)
        return credentials
    
    except Exception as e:
        db.rollback()
        print(f"✗ Error setting login credentials: {e}")
        raise
    finally:
        db.close()
        
def check_director_credentials(email: str, password_raw: str) -> bool:
    """Check if the provided password is correct for the given director email"""
    # Similar implementation to check_credentials but for DirectorCredentials model
    db = SessionLocal()
    try:
        credentials = db.query(DirectorCredentials).filter(DirectorCredentials.email == email).first()
        if credentials:
            print(f"✓ Found login credentials for director: {email}")
            if verify_password(password_raw, credentials.password_hash):
                print(f"✓ Password hash matches for director: {email}")
                return True
            else: 
                print(f"✗ Password hash does NOT match for director: {email}")
                return False
        else:
            print(f"✗ No login credentials found for director: {email}")
            return False
    except Exception as e:
        print(f"✗ Error fetching login credentials: {e}")
        raise
    finally:
        db.close()
def delete_director_credentials(email: str) -> bool:
    """Delete director credentials for a specific email"""
    # Similar implementation to delete_login_credentials but for DirectorCredentials model
    db = SessionLocal()
    try:
        credentials = db.query(DirectorCredentials).filter(DirectorCredentials.email == email).first()
        if credentials:
            db.delete(credentials)
            db.commit()
            print(f"✓ Deleted login credentials for director: {email}")
            return True
        else:
            print(f"✗ No login credentials found for director: {email}")
            return False
    except Exception as e:
        db.rollback()
        print(f"✗ Error deleting login credentials: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # check all pantries
    get_pantry_items(7)
