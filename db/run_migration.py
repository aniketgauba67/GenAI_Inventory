"""Run SQL migration script against the database."""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
import psycopg2

# Load environment variables
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / "back" / ".env")

def run_migration(migration_file: str):
    """Execute a SQL migration file."""
    migration_path = Path(__file__).parent / "migrations" / migration_file
    
    if not migration_path.exists():
        print(f"✗ Migration file not found: {migration_path}")
        sys.exit(1)
    
    print(f"📄 Reading migration: {migration_file}")
    with open(migration_path, 'r') as f:
        migration_sql = f.read()
    
    print(f"🔗 Connecting to database: {os.getenv('DB_HOST')}")
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            port=os.getenv('DB_PORT'),
            dbname=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD')
        )
        
        cur = conn.cursor()
        
        print("⚙️  Executing migration...")
        cur.execute(migration_sql)
        conn.commit()
        
        print("✓ Migration completed successfully!")
        
        cur.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"✗ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    migration_file = "2026-03-03_inventory_schema_cleanup.sql"
    if len(sys.argv) > 1:
        migration_file = sys.argv[1]
    
    run_migration(migration_file)
