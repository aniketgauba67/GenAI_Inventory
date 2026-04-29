"""Print the live database schema in a readable table-style terminal format.

This is a read-only helper for checking the final schema in the actual database, not just the ORM.
"""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import inspect

from db.database import engine


def main() -> None:
    """Inspect the live database and print tables, columns, and key markers."""
    load_dotenv(Path(__file__).resolve().parent / ".env")

    inspector = inspect(engine)

    for table_name in inspector.get_table_names():
        print(f"TABLE: {table_name}")

        pk = (inspector.get_pk_constraint(table_name) or {}).get("constrained_columns", [])
        fks = inspector.get_foreign_keys(table_name) or []

        for column in inspector.get_columns(table_name):
            nullable = "NULL" if column["nullable"] else "NOT NULL"
            markers = []

            if column["name"] in pk:
                markers.append("PK")

            for fk in fks:
                if column["name"] in (fk.get("constrained_columns") or []):
                    referred_table = fk.get("referred_table")
                    referred_columns = ", ".join(fk.get("referred_columns") or [])
                    markers.append(f"FK -> {referred_table}({referred_columns})")

            marker_text = f" [{' | '.join(markers)}]" if markers else ""
            print(f"  - {column['name']}: {column['type']} {nullable}{marker_text}")

        print("")


if __name__ == "__main__":
    main()
