import psycopg
from os import getenv

def init_db():
    db_url = getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set")
    # We assume schema is already migrated; just validate connectivity.
    with psycopg.connect(db_url) as conn:
        conn.execute("SELECT 1")
        conn.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS king TEXT")
        conn.execute("ALTER TABLE global_high_scores ADD COLUMN IF NOT EXISTS campaign_length INTEGER")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_streaks (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                streak INTEGER NOT NULL DEFAULT 0,
                last_completed_date TEXT,
                PRIMARY KEY (user_id, campaign_id)
            )
        """)
    print("✅ Database connection verified!")
