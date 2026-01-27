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
        conn.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ruler_id INTEGER")
        conn.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ruler_title TEXT")
        conn.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_admin_campaign BOOLEAN DEFAULT FALSE")
        conn.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ruler_background_image_url TEXT")
        conn.execute("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ruler_background_image_key TEXT")
        conn.execute("ALTER TABLE global_high_scores ADD COLUMN IF NOT EXISTS campaign_length INTEGER")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_key TEXT")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_thumb_url TEXT")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_thumb_key TEXT")
        conn.execute("UPDATE users SET is_admin = TRUE WHERE id = 2")
        conn.execute("ALTER TABLE campaign_members ADD COLUMN IF NOT EXISTS army_image_url TEXT")
        conn.execute("ALTER TABLE campaign_members ADD COLUMN IF NOT EXISTS army_image_key TEXT")
        conn.execute("ALTER TABLE campaign_members ADD COLUMN IF NOT EXISTS army_image_thumb_url TEXT")
        conn.execute("ALTER TABLE campaign_members ADD COLUMN IF NOT EXISTS army_image_thumb_key TEXT")
        conn.execute("ALTER TABLE campaign_members ADD COLUMN IF NOT EXISTS army_name TEXT")
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
            CREATE TABLE IF NOT EXISTS campaign_streak_cycle (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                streak INTEGER NOT NULL DEFAULT 0,
                last_completed_date TEXT,
                PRIMARY KEY (user_id, campaign_id)
            )
        """)
        conn.execute("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'campaign_streak_term'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'campaign_streak_cycle'
                ) THEN
                    ALTER TABLE campaign_streak_term RENAME TO campaign_streak_cycle;
                END IF;
            END $$;
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
            CREATE TABLE IF NOT EXISTS campaign_user_items (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                item_key TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0,
                acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, campaign_id, item_key)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_user_status_effects (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                effect_key TEXT NOT NULL,
                effect_value TEXT,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                PRIMARY KEY (user_id, campaign_id, effect_key)
            )
        """)
        conn.execute("ALTER TABLE campaign_user_status_effects ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE")
        conn.execute("""
            UPDATE campaign_user_status_effects
            SET active = TRUE
            WHERE active IS NULL
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_shop_log (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                item_key TEXT,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_item_events (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                item_key TEXT NOT NULL,
                target_user_id INTEGER,
                event_type TEXT NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_shop_rotation (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                items JSONB NOT NULL,
                reshuffles INTEGER NOT NULL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, campaign_id, date)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS global_item_stats (
                item_key TEXT PRIMARY KEY,
                uses INTEGER NOT NULL DEFAULT 0,
                targets INTEGER NOT NULL DEFAULT 0,
                last_used_at TIMESTAMP
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
            CREATE TABLE IF NOT EXISTS campaign_daily_recaps (
                campaign_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                summary TEXT,
                highlights JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (campaign_id, date)
            )
        """)
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
            CREATE TABLE IF NOT EXISTS global_accolade_stats (
                accolade_key TEXT PRIMARY KEY,
                count INTEGER NOT NULL DEFAULT 0,
                last_awarded_at TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS campaign_accolade_stats (
                campaign_id INTEGER NOT NULL,
                accolade_key TEXT NOT NULL,
                count INTEGER NOT NULL DEFAULT 0,
                last_awarded_at TIMESTAMP,
                PRIMARY KEY (campaign_id, accolade_key)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_accolade_stats (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                accolade_key TEXT NOT NULL,
                count INTEGER NOT NULL DEFAULT 0,
                last_awarded_at TIMESTAMP,
                PRIMARY KEY (user_id, campaign_id, accolade_key)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_accolade_events (
                user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL,
                accolade_key TEXT NOT NULL,
                date TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, campaign_id, accolade_key, date)
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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS global_streak_stats (
                id INTEGER PRIMARY KEY DEFAULT 1,
                highest_streak INTEGER NOT NULL DEFAULT 0,
                user_id INTEGER,
                campaign_id INTEGER,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS global_user_streaks (
                user_id INTEGER PRIMARY KEY,
                highest_streak INTEGER NOT NULL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS update_logs (
                id SERIAL PRIMARY KEY,
                date TEXT NOT NULL,
                title TEXT NOT NULL,
                items JSONB NOT NULL DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    print("✅ Database connection verified!")
