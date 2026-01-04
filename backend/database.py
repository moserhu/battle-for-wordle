import psycopg
from os import getenv

def init_db():
    db_url = getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set")
    # We assume schema is already migrated; just validate connectivity.
    with psycopg.connect(db_url) as conn:
        conn.execute("SELECT 1")
    print("✅ Database connection verified!")
