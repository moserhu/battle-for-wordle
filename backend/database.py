import sqlite3

def init_db():
    with sqlite3.connect("game.db") as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT,
                last_name TEXT,
                email TEXT UNIQUE,
                phone TEXT,
                password TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                owner_id INTEGER,
                invite_code TEXT UNIQUE,
                start_date TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_members (
                user_id INTEGER,
                campaign_id INTEGER,
                score INTEGER DEFAULT 0,
                PRIMARY KEY (user_id, campaign_id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS guesses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                word TEXT NOT NULL,
                date TEXT NOT NULL
            )
        """)
