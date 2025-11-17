import sqlite3
from os import getenv

def init_db():
    with sqlite3.connect(getenv("DB_PATH")) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT,
                last_name TEXT,
                email TEXT UNIQUE,
                phone TEXT,
                password TEXT,
                campaigns INTEGER DEFAULT 0,
                total_guesses INTEGER DEFAULT 0,
                correct_guesses INTEGER DEFAULT 0,
                campaign_wins INTEGER DEFAULT 0,
                campaign_losses INTEGER DEFAULT 0,
                clicked_update INTEGER DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                owner_id INTEGER,
                invite_code TEXT UNIQUE,
                start_date TEXT,
                cycle_length INTEGER DEFAULT 5
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_members (
                campaign_id INTEGER,
                user_id INTEGER,
                score INTEGER DEFAULT 0,
                display_name TEXT,
                color TEXT DEFAULT '#d4af7f',
                double_down_used_week INTEGER DEFAULT 0,
                double_down_activated INTEGER DEFAULT 0,
                double_down_date TEXT,
                PRIMARY KEY (campaign_id, user_id),
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_guesses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                word TEXT NOT NULL,
                date TEXT NOT NULL,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_daily_progress (
                campaign_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                completed INTEGER,
                PRIMARY KEY (campaign_id, user_id, date),
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
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
                PRIMARY KEY (user_id, campaign_id, date),
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_words (
                campaign_id INTEGER NOT NULL,
                day INTEGER NOT NULL,
                word TEXT NOT NULL,
                PRIMARY KEY (campaign_id, day),
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS global_high_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                campaign_id INTEGER,
                player_name TEXT NOT NULL,
                campaign_name TEXT NOT NULL,
                troops INTEGER NOT NULL,
                ended_on TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
            )
        """)


    print("✅ Database initialized!")