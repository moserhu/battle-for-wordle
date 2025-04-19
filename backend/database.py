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
                campaign_id INTEGER,
                user_id INTEGER,
                score INTEGER DEFAULT 0,
                PRIMARY KEY (campaign_id, user_id)
            )
        """)
        conn.execute("""
            CREATE TABLE campaign_guesses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                word TEXT NOT NULL,
                date TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE campaign_daily_progress (
                campaign_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                completed INTEGER, -- 1 = done (won/lost), 0 = in progress
                 PRIMARY KEY (campaign_id, user_id, date)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_guess_states (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                guesses TEXT NOT NULL,
                results TEXT NOT NULL,
                letter_status TEXT NOT NULL,
                current_row INTEGER NOT NULL,
                game_over INTEGER NOT NULL,
                PRIMARY KEY (user_id, campaign_id, date)
            )
        """)
