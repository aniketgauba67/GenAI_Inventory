"""******************************* database.py ***************************************
 *
 *  Module: Database
 *
 *  This module supports database access for the GenAI Inventory backend.
 *
 *  The module provides:
 *
 *  - SQLAlchemy models, session helpers, or seed utilities.
 *  - database-facing helpers used by backend routes.
 *
 *  Key Structures Used:
 *
 *  - SQLAlchemy engines, sessions, models, and pantry records.
 *
 *  This module ensures:
 *
 *  - database code stays separate from route handlers.
 *  - backend persistence uses a consistent schema.
 *
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, URL
from sqlalchemy.orm import sessionmaker, Session, declarative_base

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / "back" / ".env")

DATABASE_URL = URL.create(
    drivername="postgresql+psycopg2",
    username=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT", 5432)),
    database=os.getenv("DB_NAME"),
)

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5, "sslmode": "require"},
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for declarative models
Base = declarative_base()


def get_db():
    """Get a database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    "Delete existing tables and create new ones based on models"""
    #Base.metadata.drop_all(bind=engine)  # Drop all tables (for testing)
    """Initialize database by creating all tables"""
    Base.metadata.create_all(bind=engine)
