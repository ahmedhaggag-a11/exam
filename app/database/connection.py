# Database Engine & Session Management
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, scoped_session
from app.config.settings import AppConfig
from app.models.base import Base

engine = None
SessionLocal = None

def get_engine():
    global engine
    if engine is None:
        db_uri = AppConfig.get_database_uri()
        if db_uri.startswith("sqlite"):
            engine = create_engine(
                db_uri,
                connect_args={"check_same_thread": False},
                echo=False
            )
            # Enable SQLite foreign keys & WAL performance mode
            @event.listens_for(engine, "connect")
            def set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA synchronous=NORMAL")
                cursor.execute("PRAGMA temp_store=MEMORY")
                cursor.execute("PRAGMA cache_size=-16000")
                cursor.close()
        else:
            engine = create_engine(
                db_uri,
                pool_pre_ping=True,
                pool_recycle=3600,
                echo=False
            )
    return engine

def get_session_factory():
    global SessionLocal
    if SessionLocal is None:
        eng = get_engine()
        SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=eng))
    return SessionLocal

def get_db():
    session_factory = get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()

def migrate_educational_sources_schema(eng):
    from sqlalchemy import text, inspect
    insp = inspect(eng)
    if not insp.has_table("educational_sources"):
        return
    existing_cols = {col["name"] for col in insp.get_columns("educational_sources")}
    required_columns = [
        ("source_type", "TEXT DEFAULT 'textbook'"),
        ("term", "TEXT"),
        ("branch", "TEXT"),
        ("chapter", "TEXT"),
        ("lesson", "TEXT"),
        ("pages_count", "INTEGER DEFAULT 0"),
        ("status", "TEXT DEFAULT 'certified'"),
        ("file_path", "TEXT"),
        ("file_name", "TEXT"),
        ("file_size_kb", "INTEGER"),
        ("content_extracted", "INTEGER DEFAULT 0"),
        ("extracted_text", "TEXT"),
        ("parent_source_id", "INTEGER REFERENCES educational_sources(id) ON DELETE SET NULL"),
        ("author_name", "TEXT"),
        ("grade_level", "TEXT"),
        ("publisher", "TEXT"),
        ("publication_year", "INTEGER"),
        ("description_ar", "TEXT"),
        ("chapters_json", "TEXT"),
    ]
    with eng.connect() as conn:
        for col_name, col_def in required_columns:
            if col_name not in existing_cols:
                try:
                    conn.execute(text(f"ALTER TABLE educational_sources ADD COLUMN {col_name} {col_def}"))
                    conn.commit()
                    print(f"  [Migration] Added column: educational_sources.{col_name}")
                except Exception as e:
                    print(f"  [Migration] Skip adding {col_name}: {e}")


def migrate_exams_schema(eng):
    from sqlalchemy import text, inspect
    insp = inspect(eng)
    if not insp.has_table("exams"):
        return
    existing_cols = {col["name"] for col in insp.get_columns("exams")}
    required_columns = [
        ("language", "TEXT DEFAULT 'ar'"),
        ("template_id", "INTEGER"),
    ]
    with eng.connect() as conn:
        for col_name, col_def in required_columns:
            if col_name not in existing_cols:
                try:
                    conn.execute(text(f"ALTER TABLE exams ADD COLUMN {col_name} {col_def}"))
                    conn.commit()
                    print(f"  [Migration] Added column: exams.{col_name}")
                except Exception as e:
                    print(f"  [Migration] Skip adding exams.{col_name}: {e}")


def init_db():
    eng = get_engine()
    # Create all tables
    Base.metadata.create_all(bind=eng)

    # Run schema migrations for legacy databases
    migrate_educational_sources_schema(eng)
    migrate_exams_schema(eng)
    migrate_questions_schema(eng)

    # Check if seeding is needed
    from app.database.seed_data import seed_initial_data
    seed_initial_data()


def migrate_questions_schema(eng):
    from sqlalchemy import text, inspect
    insp = inspect(eng)
    if not insp.has_table("questions"):
        return
    existing_cols = {col["name"] for col in insp.get_columns("questions")}
    required_columns = [
        ("grade_level", "TEXT"),
        ("branch", "TEXT"),
        ("lesson", "TEXT"),
        ("image_paths_json", "TEXT"),
    ]
    with eng.connect() as conn:
        for col_name, col_def in required_columns:
            if col_name not in existing_cols:
                try:
                    conn.execute(text(f"ALTER TABLE questions ADD COLUMN {col_name} {col_def}"))
                    conn.commit()
                    print(f"  [Migration] Added column: questions.{col_name}")
                except Exception as e:
                    print(f"  [Migration] Skip adding questions.{col_name}: {e}")
