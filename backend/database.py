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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_coins (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                coins INTEGER NOT NULL DEFAULT 0,
                last_awarded_date TEXT,
                PRIMARY KEY (user_id, campaign_id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_daily_troops (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                troops INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, campaign_id, date)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_daily_stats (
                campaign_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                total_troops INTEGER NOT NULL DEFAULT 0,
                avg_troops_per_player REAL NOT NULL DEFAULT 0,
                highest_troops INTEGER NOT NULL DEFAULT 0,
                completed_count INTEGER NOT NULL DEFAULT 0,
                member_count INTEGER NOT NULL DEFAULT 0,
                completion_rate REAL NOT NULL DEFAULT 0,
                fast_solve_count INTEGER NOT NULL DEFAULT 0,
                clutch_wins INTEGER NOT NULL DEFAULT 0,
                double_down_used INTEGER NOT NULL DEFAULT 0,
                double_down_success INTEGER NOT NULL DEFAULT 0,
                participation_pct REAL NOT NULL DEFAULT 0,
                hardest_word TEXT,
                easiest_word TEXT,
                PRIMARY KEY (campaign_id, date)
            )
        """)
        conn.execute("ALTER TABLE campaign_daily_stats ADD COLUMN IF NOT EXISTS hardest_word TEXT")
        conn.execute("ALTER TABLE campaign_daily_stats ADD COLUMN IF NOT EXISTS easiest_word TEXT")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_first_guesses (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                word TEXT NOT NULL,
                PRIMARY KEY (user_id, campaign_id, date)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS store_purchases (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                item_key TEXT NOT NULL,
                category TEXT NOT NULL,
                cost INTEGER NOT NULL,
                purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_user_daily_results (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                word TEXT,
                guesses_used INTEGER NOT NULL,
                solved INTEGER NOT NULL,
                first_guess_word TEXT,
                used_double_down INTEGER NOT NULL DEFAULT 0,
                double_down_success INTEGER NOT NULL DEFAULT 0,
                double_down_bonus_troops INTEGER NOT NULL DEFAULT 0,
                troops_earned INTEGER NOT NULL DEFAULT 0,
                coins_earned INTEGER NOT NULL DEFAULT 0,
                completed_at TIMESTAMP,
                PRIMARY KEY (user_id, campaign_id, date)
            )
        """)
        conn.execute("ALTER TABLE campaign_user_daily_results ADD COLUMN IF NOT EXISTS word TEXT")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_campaign_stats (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                total_solves INTEGER NOT NULL DEFAULT 0,
                total_fails INTEGER NOT NULL DEFAULT 0,
                total_guesses_on_solves INTEGER NOT NULL DEFAULT 0,
                total_days_played INTEGER NOT NULL DEFAULT 0,
                current_streak INTEGER NOT NULL DEFAULT 0,
                longest_streak INTEGER NOT NULL DEFAULT 0,
                streak_recovery_days INTEGER,
                double_down_used INTEGER NOT NULL DEFAULT 0,
                double_down_success INTEGER NOT NULL DEFAULT 0,
                double_down_bonus_troops INTEGER NOT NULL DEFAULT 0,
                coins_earned_total INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, campaign_id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_daily_word_stats (
                campaign_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                word TEXT NOT NULL,
                solved_count INTEGER NOT NULL DEFAULT 0,
                failed_count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (campaign_id, date, word)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS global_daily_stats (
                date TEXT PRIMARY KEY,
                total_campaigns_completed INTEGER NOT NULL DEFAULT 0,
                total_players INTEGER NOT NULL DEFAULT 0,
                total_guesses INTEGER NOT NULL DEFAULT 0,
                guess_1 INTEGER NOT NULL DEFAULT 0,
                guess_2 INTEGER NOT NULL DEFAULT 0,
                guess_3 INTEGER NOT NULL DEFAULT 0,
                guess_4 INTEGER NOT NULL DEFAULT 0,
                guess_5 INTEGER NOT NULL DEFAULT 0,
                guess_6 INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS global_word_stats (
                word TEXT PRIMARY KEY,
                attempts INTEGER NOT NULL DEFAULT 0,
                solves INTEGER NOT NULL DEFAULT 0,
                fails INTEGER NOT NULL DEFAULT 0,
                first_seen TEXT,
                last_seen TEXT
            )
        """)
    print("✅ Database connection verified!")
