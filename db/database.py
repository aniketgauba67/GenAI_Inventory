"""Database connection and session management using SQLAlchemy"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base

load_dotenv()

# Create database URL from environment variables
DATABASE_URL = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT', 5432)}/{os.getenv('DB_NAME')}"
)

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL debugging
    pool_pre_ping=True,  # Test connection before using
    connect_args={"connect_timeout": 5}
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
    Base.metadata.drop_all(bind=engine)  # Drop all tables (for testing)
    """Initialize database by creating all tables"""
    Base.metadata.create_all(bind=engine)
