"""Seed the database with real Licking County pantry data from the PDF.

Drops all existing pantries, inventory items, runs, and credentials,
then inserts 27 real pantry locations with operating hours.
Each pantry gets a default login password of 'pantry123'.
"""

from sqlalchemy import text
from db.database import SessionLocal, engine
from db.models import InventoryItem, InventoryRun, LoginCredentials, Pantry
from db.password_utils import hash_password

REAL_PANTRIES = [
    # --- Newark, Ohio ---
    {
        "name": "FPN Market at LMHS",
        "location": "131 McMillen Dr, Newark, OH 43055",
        "operating_hours": [
            {"day": "mon", "open": "11:00", "close": "16:00"},
            {"day": "tue", "open": "11:00", "close": "16:00"},
            {"day": "wed", "open": "11:00", "close": "16:00"},
            {"day": "thu", "open": "11:00", "close": "16:00"},
            {"day": "fri", "open": "11:00", "close": "16:00"},
        ],
    },
    {
        "name": "FPN Market on Brice St",
        "location": "1025 Brice St, Newark, OH 43055",
        "operating_hours": [
            {"day": "mon", "open": "14:00", "close": "17:30"},
            {"day": "thu", "open": "14:00", "close": "17:30"},
            {"day": "tue", "open": "09:00", "close": "12:00"},
            {"day": "sat", "open": "09:00", "close": "12:00"},
        ],
    },
    {
        "name": "Seventh Day Adventist",
        "location": "122 East Main St, Newark, OH 43055",
        "operating_hours": [
            {"day": "tue", "open": "09:30", "close": "11:30"},
            {"day": "wed", "open": "09:30", "close": "11:30"},
            {"day": "thu", "open": "09:30", "close": "11:30"},
        ],
    },
    {
        "name": "Last Call Ministries",
        "location": "310 Everett Ave, Newark, OH 43055",
        "operating_hours": [
            {"day": "mon", "open": "10:00", "close": "13:00"},
            {"day": "fri", "open": "10:00", "close": "13:00"},
        ],
    },
    {
        "name": "St. Vincent DePaul Society",
        "location": "135 Wilson St, Newark, OH 43055",
        "operating_hours": [
            {"day": "tue", "open": "18:30", "close": "20:00"},
            {"day": "sat", "open": "09:00", "close": "11:00"},
        ],
    },
    {
        "name": "Market Street Pantry",
        "location": "37 1/2 South 4th St, Newark, OH 43055",
        "operating_hours": [
            {"day": "wed", "open": "08:30", "close": "11:30"},
            {"day": "sat", "open": "08:30", "close": "11:30"},
        ],
    },
    {
        "name": "Family of Faith Church",
        "location": "975 Mt. Vernon Rd, Newark, OH 43055",
        "operating_hours": [
            {"day": "wed", "open": "16:30", "close": "18:30"},
        ],
    },
    {
        "name": "Salvation Army",
        "location": "250 East Main St, Newark, OH 43055",
        "operating_hours": [
            {"day": "mon", "open": "13:00", "close": "15:00"},
            {"day": "wed", "open": "13:00", "close": "15:00"},
        ],
    },
    {
        "name": "Second Presbyterian Church",
        "location": "42 East Church St, Newark, OH 43055",
        "operating_hours": [
            {"day": "tue", "open": "10:00", "close": "12:00"},
            {"day": "thu", "open": "10:00", "close": "12:00"},
        ],
    },
    {
        "name": "Newark Nazarene Church",
        "location": "71 Maholm St, Newark, OH 43055",
        "operating_hours": [
            {"day": "tue", "open": "10:00", "close": "12:00"},
            {"day": "thu", "open": "10:00", "close": "12:00"},
        ],
    },
    {
        "name": "Christ Cornerstone Church",
        "location": "69 King Avenue, Newark, OH 43055",
        "operating_hours": [
            {"day": "wed", "open": "16:30", "close": "18:00"},
        ],
    },
    {
        "name": "Marne Church",
        "location": "1019 Licking Valley Rd, Newark, OH 43055",
        "operating_hours": [
            {"day": "tue", "open": "09:00", "close": "12:00"},
        ],
    },
    {
        "name": "Wright Memorial Methodist (Once a Month)",
        "location": "735 Mt. Vernon Road, Newark, OH 43055",
        "operating_hours": [
            {"day": "tue", "open": "10:30", "close": "12:30"},
            {"day": "thu", "open": "10:30", "close": "12:30"},
        ],
    },
    # --- Licking County Area ---
    {
        "name": "Waters Edge/Buckeye Lake",
        "location": "4894 Walnut Rd, Buckeye Lake, OH 43008",
        "operating_hours": [
            {"day": "mon", "open": "12:00", "close": "13:00"},
            {"day": "wed", "open": "12:00", "close": "13:00"},
            {"day": "fri", "open": "12:00", "close": "13:00"},
        ],
    },
    {
        "name": "Buckeye Lake LEADS",
        "location": "41 First St, Buckeye Lake, OH 43008",
        "operating_hours": [
            {"day": "tue", "open": "09:00", "close": "12:00"},
            {"day": "thu", "open": "09:00", "close": "12:00"},
        ],
    },
    {
        "name": "Jacksontown UMC",
        "location": "9350 Jacksontown Rd, Jacksontown, OH 43030",
        "operating_hours": [
            {"day": "wed", "open": "10:00", "close": "12:00"},
            {"day": "wed", "open": "18:00", "close": "19:00"},
        ],
    },
    {
        "name": "Pataskala LEADS",
        "location": "12536 Adams Lane SW, Pataskala, OH",
        "operating_hours": [
            {"day": "mon", "open": "10:00", "close": "12:00"},
            {"day": "wed", "open": "10:00", "close": "12:00"},
        ],
    },
    {
        "name": "Pataskala UMC (April-Nov.)",
        "location": "458 South Main St, Pataskala, OH 43062",
        "operating_hours": [
            {"day": "tue", "open": "11:30", "close": "12:30"},
        ],
    },
    {
        "name": "Kirkersville UMC (March-Nov.)",
        "location": "108 East Main St, Kirkersville, OH 43033",
        "operating_hours": [
            {"day": "wed", "open": "09:00", "close": "09:30"},
        ],
    },
    {
        "name": "Alexandria UMC (March-Nov.)",
        "location": "72 Church St, Alexandria, OH 43001",
        "operating_hours": [
            {"day": "thu", "open": "09:30", "close": "11:00"},
        ],
    },
    {
        "name": "St. Alban's Fire Dept (Nov-March)",
        "location": "25 East Main St, Alexandria, OH 43001",
        "operating_hours": [
            {"day": "thu", "open": "09:30", "close": "11:00"},
        ],
    },
    {
        "name": "Christ Ev. Lutheran Church (Easter-Thanksgiving)",
        "location": "732 Hebron Rd, Heath, OH 43056",
        "operating_hours": [
            {"day": "fri", "open": "09:30", "close": "10:30"},
        ],
    },
    {
        "name": "Heath Fire Department (Thanksgiving-Easter)",
        "location": "93 Heath Rd, Heath, OH 43056",
        "operating_hours": [
            {"day": "fri", "open": "09:30", "close": "10:30"},
        ],
    },
    {
        "name": "Croton Church of Christ",
        "location": "40 S. Main St, Croton, OH 43013",
        "operating_hours": [
            {"day": "mon", "open": "10:00", "close": "12:00"},
        ],
    },
    {
        "name": "Johnstown/Faithcare Pantry",
        "location": "140 Pratt St, Johnstown, OH 43031",
        "operating_hours": [
            {"day": "thu", "open": "10:00", "close": "12:00"},
        ],
    },
    {
        "name": "Utica LEADS",
        "location": "308 North Main St, Utica, OH 43080",
        "operating_hours": [
            {"day": "thu", "open": "15:30", "close": "17:30"},
        ],
    },
]

DEFAULT_PASSWORD = "pantry123"


def seed():
    db = SessionLocal()
    try:
        print("Deleting existing data...")
        db.query(InventoryRun).delete()
        db.query(InventoryItem).delete()
        db.query(LoginCredentials).delete()
        db.query(Pantry).delete()
        db.execute(text("ALTER SEQUENCE pantries_id_seq RESTART WITH 1"))
        db.execute(text("ALTER SEQUENCE inventory_items_id_seq RESTART WITH 1"))
        db.execute(text("ALTER SEQUENCE login_credentials_id_seq RESTART WITH 1"))
        db.commit()
        print("Existing data cleared.")

        pw_hash = hash_password(DEFAULT_PASSWORD)

        for entry in REAL_PANTRIES:
            pantry = Pantry(
                name=entry["name"],
                location=entry["location"],
                operating_hours=entry["operating_hours"] or None,
                is_open=False,
            )
            db.add(pantry)
            db.flush()

            cred = LoginCredentials(pantry_id=pantry.id, password_hash=pw_hash)
            db.add(cred)
            print(f"  + {pantry.id:>2}: {pantry.name}")

        db.commit()
        print(f"\nSeeded {len(REAL_PANTRIES)} pantries. Default password: {DEFAULT_PASSWORD}")
    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
