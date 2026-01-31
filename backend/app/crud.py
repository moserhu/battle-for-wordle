import psycopg
from psycopg.rows import tuple_row
from datetime import datetime
import string
import random
from zoneinfo import ZoneInfo  
from hashlib import sha256
from collections import Counter
import os
from fastapi import HTTPException
import json
from jose import JWTError, jwt
from datetime import timedelta
import os
from dotenv import load_dotenv
import bcrypt

# Load environment variables from .env file
load_dotenv()

from app.items import ITEM_CATALOG, get_item
from app.accolades.service import (
    award_accolade,
    is_lucky_strike,
    classify_time_accolades,
    SHOP_REGULAR_THRESHOLD,
    ITEM_MASTER_THRESHOLD,
    BIG_SPENDER_THRESHOLD,
    HOARDER_THRESHOLD,
    list_user_accolades,
)
from app.utils.campaigns import resolve_campaign_day
from app.media.storage import create_presigned_download

DB_URL = os.getenv("DATABASE_URL")

def get_db():
    if not DB_URL:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(DB_URL, row_factory=tuple_row)

def is_admin_user(conn, user_id: int) -> bool:
    row = conn.execute(
        "SELECT COALESCE(is_admin, FALSE) FROM users WHERE id = %s",
        (user_id,)
    ).fetchone()
    return bool(row[0]) if row else False

def is_admin_campaign(conn, campaign_id: int) -> bool:
    row = conn.execute(
        "SELECT COALESCE(is_admin_campaign, FALSE) FROM campaigns WHERE id = %s",
        (campaign_id,)
    ).fetchone()
    return bool(row[0]) if row else False



def register_user(first_name, last_name, email, phone, password):
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    with get_db() as conn:
        try:
            conn.execute("""
                INSERT INTO users (first_name, last_name, email, phone, password)
                VALUES (%s, %s, %s, %s, %s)
            """, (first_name, last_name, email.lower(), phone, hashed_pw))
            return {"status": "ok"}
        except psycopg.errors.UniqueViolation as e:
            if "email" in str(e).lower():
                raise HTTPException(status_code=400, detail="Email already registered")
            elif "phone" in str(e).lower():
                raise HTTPException(status_code=400, detail="Phone number already registered")
            else:
                raise HTTPException(status_code=400, detail="Registration failed")



def login_user(email, password):
    with get_db() as conn:
        user = conn.execute(
            "SELECT id, first_name, password, COALESCE(is_admin, FALSE) FROM users WHERE email = %s",
            (email.lower(),)
        ).fetchone()

        if user:
            stored_pw = user[2]
            if isinstance(stored_pw, memoryview):
                stored_pw = stored_pw.tobytes()
            elif isinstance(stored_pw, str):
                if stored_pw.startswith("\\x"):
                    stored_pw = bytes.fromhex(stored_pw[2:])
                else:
                    stored_pw = stored_pw.encode('utf-8')

            if bcrypt.checkpw(password.encode('utf-8'), stored_pw):
                return {"user_id": user[0], "first_name": user[1], "is_admin": bool(user[3])}

        raise HTTPException(status_code=401, detail="Invalid credentials")



def create_campaign(name, user_id, cycle_length, is_admin_campaign: bool = False):
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")

    with get_db() as conn:
        if is_admin_campaign and not is_admin_user(conn, user_id):
            raise HTTPException(status_code=403, detail="Admin privileges required")
        cur = conn.execute("""
            INSERT INTO campaigns (name, owner_id, invite_code, start_date, cycle_length, is_admin_campaign)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (name, user_id, code, today, cycle_length, bool(is_admin_campaign)))

        camp_id = cur.fetchone()[0]

        # Fetch the user's first name for default display name
        user_row = conn.execute("SELECT first_name FROM users WHERE id = %s", (user_id,)).fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        default_name = user_row[0]

        # Default color for campaign creator
        default_color = "#ffd700"

        conn.execute("""
            INSERT INTO campaign_members (user_id, campaign_id, display_name, color)
            VALUES (%s, %s, %s, %s)
        """, (user_id, camp_id, default_name, default_color))

        if not is_admin_campaign:
            conn.execute("UPDATE users SET campaigns = campaigns + 1 WHERE id = %s", (user_id,))
        else:
            all_colors = ['#ffd700', '#c0c0c0', '#cd7f32', '#4caf50', '#2196f3',
                          '#9c27b0', '#ff5722', '#00bcd4', '#795548', '#607d8b']
            used_colors = {default_color}
            for i in range(3):
                random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
                email = f"test_{camp_id}_{i}_{random_suffix}@example.com"
                phone = f"9{camp_id:04d}{i}{random.randint(1000, 9999)}"
                hashed_pw = bcrypt.hashpw(f"test_{camp_id}_{i}".encode("utf-8"), bcrypt.gensalt())
                fake_row = conn.execute("""
                    INSERT INTO users (first_name, last_name, email, phone, password)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, ("Test", f"User {i + 1}", email, phone, hashed_pw)).fetchone()
                fake_user_id = fake_row[0]
                available_color = next((c for c in all_colors if c not in used_colors), '#000000')
                used_colors.add(available_color)
                conn.execute("""
                    INSERT INTO campaign_members (user_id, campaign_id, display_name, color)
                    VALUES (%s, %s, %s, %s)
                """, (fake_user_id, camp_id, f"Test User {i + 1}", available_color))

        initialize_campaign_words(camp_id, cycle_length, conn)

    return {"campaign_id": camp_id, "invite_code": code}

def join_campaign(invite_code, user_id):
    with get_db() as conn:
        campaign = conn.execute(
            "SELECT id, COALESCE(is_admin_campaign, FALSE) FROM campaigns WHERE invite_code = %s",
            (invite_code,)
        ).fetchone()

        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")

        campaign_id, is_admin_flag = campaign
        if is_admin_flag and not is_admin_user(conn, user_id):
            raise HTTPException(status_code=403, detail="Admin campaign access denied")

        already_in = conn.execute(
            "SELECT 1 FROM campaign_members WHERE user_id = %s AND campaign_id = %s",
            (user_id, campaign_id)
        ).fetchone()

        if already_in:
            return {"message": "Already joined"}

        # Get user's first name
        user_row = conn.execute("SELECT first_name FROM users WHERE id = %s", (user_id,)).fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")

        default_name = user_row[0]

        # Get an unused color
        all_colors = ['#ffd700', '#c0c0c0', '#cd7f32', '#4caf50', '#2196f3',
                      '#9c27b0', '#ff5722', '#00bcd4', '#795548', '#607d8b']
        used_colors = conn.execute(
            "SELECT color FROM campaign_members WHERE campaign_id = %s", (campaign_id,)
        ).fetchall()
        used_colors = {row[0] for row in used_colors if row[0]}
        available_color = next((c for c in all_colors if c not in used_colors), '#000000')

        # Insert member with display name and color
        conn.execute("""
            INSERT INTO campaign_members (user_id, campaign_id, display_name, color)
            VALUES (%s, %s, %s, %s)
        """, (user_id, campaign_id, default_name, available_color))

        if not is_admin_flag:
            conn.execute("UPDATE users SET campaigns = campaigns + 1 WHERE id = %s", (user_id,))

        return {"message": "Joined campaign", "campaign_id": campaign_id}


def join_campaign_by_id(campaign_id, user_id):
    with get_db() as conn:
        # 🔒 Check for campaign expiration
        row = conn.execute("""
            SELECT start_date, cycle_length, COALESCE(is_admin_campaign, FALSE)
            FROM campaigns
            WHERE id = %s
        """, (campaign_id,)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Campaign not found")

        start_date_str, cycle_length, is_admin_flag = row
        if is_admin_flag and not is_admin_user(conn, user_id):
            raise HTTPException(status_code=403, detail="Admin campaign access denied")
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        expire_date = start_date + timedelta(days=cycle_length)
        today = datetime.now(ZoneInfo("America/Chicago")).date()

        if today >= expire_date:
            raise HTTPException(status_code=410, detail="Invite expired")

        # ✅ Already in check
        already_in = conn.execute(
            "SELECT 1 FROM campaign_members WHERE user_id = %s AND campaign_id = %s",
            (user_id, campaign_id)
        ).fetchone()
        if already_in:
            return {"message": "Already joined"}

        # 🔧 Get user first name
        user_row = conn.execute("SELECT first_name FROM users WHERE id = %s", (user_id,)).fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")

        default_name = user_row[0]

        # 🎨 Assign color
        all_colors = ['#ffd700', '#c0c0c0', '#cd7f32', '#4caf50', '#2196f3',
                      '#9c27b0', '#ff5722', '#00bcd4', '#795548', '#607d8b']

        used_colors = conn.execute(
            "SELECT color FROM campaign_members WHERE campaign_id = %s", (campaign_id,)
        ).fetchall()
        used_colors = {row[0] for row in used_colors if row[0]}
        available_color = next((c for c in all_colors if c not in used_colors), '#000000')

        # 📝 Insert member
        conn.execute("""
            INSERT INTO campaign_members (user_id, campaign_id, display_name, color)
            VALUES (%s, %s, %s, %s)
        """, (user_id, campaign_id, default_name, available_color))

        if not is_admin_flag:
            conn.execute("UPDATE users SET campaigns = campaigns + 1 WHERE id = %s", (user_id,))
        return {"message": "Joined campaign", "campaign_id": campaign_id}

def get_user_campaigns(user_id: int):
    today = datetime.now(ZoneInfo("America/Chicago")).date()
    today_str = today.strftime("%Y-%m-%d")

    with get_db() as conn:
        rows = conn.execute("""
            SELECT 
                c.id, 
                c.name,
                c.start_date,
                c.cycle_length,
                COALESCE(c.is_admin_campaign, FALSE) as is_admin_campaign,
                EXISTS (
                    SELECT 1 FROM campaign_daily_progress dp
                    WHERE dp.user_id = %s AND dp.campaign_id = c.id
                      AND dp.date = %s
                      AND dp.completed = 1
                ) as is_finished,
                cm.double_down_activated,
                COALESCE(dp.completed, 0) as daily_completed
            FROM campaigns c
            JOIN campaign_members cm ON cm.campaign_id = c.id
            LEFT JOIN campaign_daily_progress dp 
                ON dp.user_id = cm.user_id AND dp.campaign_id = cm.campaign_id AND dp.date = %s
            WHERE cm.user_id = %s
        """, (user_id, today_str, today_str, user_id)).fetchall()

    campaign_list = []
    for row in rows:
        campaign_id, name, start_date_str, cycle_length, is_admin_campaign, is_finished, dd_activated, daily_completed = row

        # Safely calculate current day
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        day = min((today - start_date).days + 1, cycle_length)

        campaign_list.append({
            "campaign_id": campaign_id,
            "name": name,
            "day": day,
            "total": cycle_length,
            "is_admin_campaign": bool(is_admin_campaign),
            "is_finished": bool(is_finished),
            "double_down_activated": dd_activated,
            "daily_completed": daily_completed
        })

    return campaign_list


def get_user_info(user_id: int):
    with get_db() as conn:
        row = conn.execute("""
            SELECT first_name, last_name, phone, email,
                   campaigns, total_guesses, correct_guesses,
                   campaign_wins, campaign_losses, clicked_update,
                   COALESCE(is_admin, FALSE),
                   profile_image_url,
                   profile_image_key,
                   profile_image_thumb_url,
                   profile_image_thumb_key
            FROM users WHERE id = %s
        """, (user_id,)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        profile_url = None
        if row[12]:
            try:
                profile_url = create_presigned_download(row[12])
            except Exception:
                profile_url = row[11]
        thumb_url = None
        if row[14]:
            try:
                thumb_url = create_presigned_download(row[14])
            except Exception:
                thumb_url = row[13]

        return {
            "first_name": row[0],
            "last_name": row[1],
            "phone": row[2],
            "email": row[3],
            "campaigns": row[4],
            "total_guesses": row[5],
            "correct_guesses": row[6],
            "campaign_wins": row[7],
            "campaign_losses": row[8],
            "clicked_update": row[9],
            "is_admin": bool(row[10]),
            "profile_image_url": profile_url,
            "profile_image_thumb_url": thumb_url
        }

def update_user_info(user_id: int, first_name: str, last_name: str, phone: str):
    with get_db() as conn:
        try:
            conn.execute("""
                UPDATE users
                SET first_name = %s, last_name = %s, phone = %s
                WHERE id = %s
            """, (first_name, last_name, phone, user_id))
            return {"status": "ok"}
        except psycopg.errors.UniqueViolation as e:
            if "phone" in str(e).lower():
                raise HTTPException(status_code=400, detail="Phone number already registered")
            raise HTTPException(status_code=400, detail="Failed to update user info")

def update_army_name(user_id: int, campaign_id: int, army_name: str):
    with get_db() as conn:
        conn.execute(
            """
            UPDATE campaign_members
            SET army_name = %s
            WHERE campaign_id = %s AND user_id = %s
            """,
            (army_name, campaign_id, user_id)
        )
    return {"army_name": army_name}


def acknowledge_update(user_id: int):
    with get_db() as conn:
        conn.execute("""
            UPDATE users SET clicked_update = 1 WHERE id = %s
        """, (user_id,))
    return {"status": "acknowledged"}

def load_valid_words():
    base_dir = os.path.dirname(__file__)
    wordlist_path = os.path.join(base_dir, "data", "wordlist.txt")
    with open(wordlist_path, "r") as f:
        return set(word.strip().lower() for word in f.readlines())

VALID_WORDS = load_valid_words()
EXCLUSIVE_ALL_KEYS = {item["key"] for item in ITEM_CATALOG if item.get("exclusive_all")}

def load_playable_words():
    base_dir = os.path.dirname(__file__)
    wordlist_path = os.path.join(base_dir, "data", "playablewordlist.txt")
    with open(wordlist_path, "r") as f:
        return [line.strip().lower() for line in f if line.strip()]

PLAYABLE_WORDS = set(load_playable_words())

def initialize_campaign_words(campaign_id: int, num_days: int, conn):
    words = load_playable_words()
    if len(words) < num_days:
        raise HTTPException(status_code=400, detail="Not enough words in wordlist")

    selected_words = random.sample(words, num_days)

    for day, word in enumerate(selected_words, start=1):
        conn.execute(
            "INSERT INTO campaign_words (campaign_id, day, word) VALUES (%s, %s, %s)",
            (campaign_id, day, word)
        )

def _update_streak_table(conn, table: str, user_id: int, campaign_id: int, date_str: str):
    row = conn.execute(f"""
        SELECT streak, last_completed_date
        FROM {table}
        WHERE user_id = %s AND campaign_id = %s
    """, (user_id, campaign_id)).fetchone()

    if row:
        streak, last_completed_date = row
        if last_completed_date == date_str:
            return None, None
        if last_completed_date:
            last_date = datetime.strptime(last_completed_date, "%Y-%m-%d").date()
            today_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            yesterday = today_date - timedelta(days=1)
            if last_date == yesterday:
                new_streak = streak + 1
                recovery_days = None
            else:
                new_streak = 1
                recovery_days = (today_date - last_date).days - 1
        else:
            new_streak = 1
            recovery_days = None
        conn.execute(f"""
            UPDATE {table}
            SET streak = %s, last_completed_date = %s
            WHERE user_id = %s AND campaign_id = %s
        """, (new_streak, date_str, user_id, campaign_id))
    else:
        conn.execute(f"""
            INSERT INTO {table} (user_id, campaign_id, streak, last_completed_date)
            VALUES (%s, %s, %s, %s)
        """, (user_id, campaign_id, 1, date_str))
        new_streak = 1
        recovery_days = None

    return new_streak, recovery_days

def update_campaign_streak(conn, user_id: int, campaign_id: int, date_str: str, track_stats: bool = True):
    new_streak, recovery_days = _update_streak_table(
        conn, "campaign_streaks", user_id, campaign_id, date_str
    )
    _update_streak_table(conn, "campaign_streak_cycle", user_id, campaign_id, date_str)

    if new_streak is None:
        return None

    if not track_stats:
        return new_streak

    stats_row = conn.execute("""
        SELECT current_streak, longest_streak
        FROM user_campaign_stats
        WHERE user_id = %s AND campaign_id = %s
    """, (user_id, campaign_id)).fetchone()
    if stats_row:
        _, longest_streak = stats_row
        updated_longest = max(longest_streak, new_streak)
        conn.execute("""
            UPDATE user_campaign_stats
            SET current_streak = %s,
                longest_streak = %s,
                streak_recovery_days = %s
            WHERE user_id = %s AND campaign_id = %s
        """, (new_streak, updated_longest, recovery_days, user_id, campaign_id))
    else:
        conn.execute("""
            INSERT INTO user_campaign_stats (
                user_id, campaign_id, current_streak, longest_streak, streak_recovery_days
            ) VALUES (%s, %s, %s, %s, %s)
        """, (user_id, campaign_id, new_streak, new_streak, recovery_days))

    conn.execute("""
        INSERT INTO global_user_streaks (user_id, highest_streak)
        VALUES (%s, %s)
        ON CONFLICT (user_id)
        DO UPDATE SET highest_streak = GREATEST(global_user_streaks.highest_streak, EXCLUDED.highest_streak),
                      updated_at = CURRENT_TIMESTAMP
    """, (user_id, new_streak))

    global_row = conn.execute("""
        SELECT highest_streak
        FROM global_streak_stats
        WHERE id = 1
    """).fetchone()
    if not global_row:
        conn.execute("""
            INSERT INTO global_streak_stats (id, highest_streak, user_id, campaign_id)
            VALUES (1, %s, %s, %s)
        """, (new_streak, user_id, campaign_id))
    else:
        if new_streak > global_row[0]:
            conn.execute("""
                UPDATE global_streak_stats
                SET highest_streak = %s,
                    user_id = %s,
                    campaign_id = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
            """, (new_streak, user_id, campaign_id))

    return new_streak

def update_campaign_coins(conn, user_id: int, campaign_id: int, date_str: str, coins_to_add: int):
    row = conn.execute("""
        SELECT coins, last_awarded_date
        FROM campaign_coins
        WHERE user_id = %s AND campaign_id = %s
    """, (user_id, campaign_id)).fetchone()

    if row:
        current_coins, last_awarded_date = row
        if last_awarded_date == date_str:
            return current_coins
        conn.execute("""
            UPDATE campaign_coins
            SET coins = coins + %s,
                last_awarded_date = GREATEST(COALESCE(last_awarded_date, %s), %s)
            WHERE user_id = %s AND campaign_id = %s
        """, (coins_to_add, date_str, date_str, user_id, campaign_id))
        return current_coins + coins_to_add
    else:
        conn.execute("""
            INSERT INTO campaign_coins (user_id, campaign_id, coins, last_awarded_date)
            VALUES (%s, %s, %s, %s)
        """, (user_id, campaign_id, coins_to_add, date_str))
        return coins_to_add


def get_daily_word(campaign_id: int, day_override: int | None = None):
    with get_db() as conn:
        _, _, _, target_day, _ = resolve_campaign_day(conn, campaign_id, day_override)
        word_row = conn.execute(
            "SELECT word FROM campaign_words WHERE campaign_id = %s AND day = %s",
            (campaign_id, target_day)
        ).fetchone()

    if not word_row:
        raise HTTPException(status_code=404, detail="No word assigned for today")

    return word_row[0]

def validate_guess(word: str, user_id: int, campaign_id: int, day_override: int | None = None):
    points_by_row = {
        0: 150,
        1: 100,
        2: 60,
        3: 40,
        4: 30,
        5: 10
    }
    coins_by_row = {
        0: 4,
        1: 4,
        2: 4,
        3: 4,
        4: 4,
        5: 4
    }

    if word.lower() not in VALID_WORDS:
        raise HTTPException(status_code=204, detail="Invalid word")

    with get_db() as conn:
        _, cycle_length, current_day, target_day, target_date = resolve_campaign_day(
            conn, campaign_id, day_override
        )
        is_admin_flag = is_admin_campaign(conn, campaign_id)

        if target_day < current_day:
            completed_row = conn.execute("""
                SELECT completed
                FROM campaign_daily_progress
                WHERE user_id = %s AND campaign_id = %s AND date = %s
            """, (user_id, campaign_id, target_date.strftime("%Y-%m-%d"))).fetchone()
            if completed_row and completed_row[0]:
                raise HTTPException(status_code=403, detail="That day is already completed")

        secret_row = conn.execute(
            "SELECT word FROM campaign_words WHERE campaign_id = %s AND day = %s",
            (campaign_id, target_day)
        ).fetchone()
        if not secret_row:
            raise HTTPException(status_code=404, detail="No word assigned for that day")
        secret = secret_row[0]

        guess = word.lower()
        result = ['absent'] * 5
        secret_counts = Counter(secret)

        for i in range(5):
            if guess[i] == secret[i]:
                result[i] = 'correct'
                secret_counts[guess[i]] -= 1

        for i in range(5):
            if result[i] == 'correct':
                continue
            if guess[i] in secret_counts and secret_counts[guess[i]] > 0:
                result[i] = 'present'
                secret_counts[guess[i]] -= 1

        correct = all(r == 'correct' for r in result)
        target_date_str = target_date.strftime("%Y-%m-%d")

        conn.execute("BEGIN")

        # NEW: if this exact word was already guessed today, bail out without mutating state
        dup = conn.execute("""
            SELECT 1
            FROM campaign_guesses
            WHERE user_id = %s AND campaign_id = %s AND date = %s AND word = %s
        """, (user_id, campaign_id, target_date_str, guess)).fetchone()
        if dup:
            return {
                "result": result,
                "correct": correct,
                "word": secret,
                "duplicate": True
            }

        # Check if it's past midnight on final day
        is_final_day = current_day == cycle_length
        now_ct = datetime.now(ZoneInfo("America/Chicago"))
        cutoff_time = (now_ct + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

        if target_day == current_day and is_final_day and now_ct >= cutoff_time:
            raise HTTPException(status_code=403, detail="Campaign ended for the day. No more guesses allowed after midnight.")

        # Fetch progress
        row = conn.execute("""
            SELECT guesses, results, letter_status, current_row, game_over
            FROM campaign_guess_states
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, target_date_str)).fetchone()

        if row:
            guesses = json.loads(row[0])
            results_data = json.loads(row[1])
            letter_status = json.loads(row[2])
            current_row = row[3]
            game_over = bool(row[4])
        else:
            guesses = [[""] * 5 for _ in range(6)]
            results_data = [None] * 6
            letter_status = {}
            current_row = 0
            game_over = False

        if game_over or current_row >= 6:
            raise HTTPException(status_code=403, detail="You've already played today")

        effect_rows = conn.execute("""
            SELECT item_key, details
            FROM campaign_item_events
            WHERE campaign_id = %s
              AND target_user_id = %s
              AND event_type = %s
              AND (details::json->>'effective_on') = %s
        """, (campaign_id, user_id, "use", target_date_str)).fetchall()

        active_effects = {}
        for effect_row in effect_rows:
            payload = {}
            if effect_row[1]:
                try:
                    details = json.loads(effect_row[1])
                    payload = details.get("payload") or {}
                except json.JSONDecodeError:
                    payload = {}
            active_effects[effect_row[0]] = payload

        clown_payload = None
        clown_row = conn.execute("""
            SELECT effect_value
            FROM campaign_user_status_effects
            WHERE user_id = %s AND campaign_id = %s AND effect_key = %s AND active = TRUE
        """, (user_id, campaign_id, "send_in_the_clown")).fetchone()
        if not clown_row and "send_in_the_clown" in active_effects:
            preset_row = None
            payload = active_effects.get("send_in_the_clown") or {}
            if payload.get("type") == "row":
                try:
                    preset_row = int(payload.get("value"))
                except (TypeError, ValueError):
                    preset_row = None
            if preset_row is None or preset_row < 2 or preset_row > 6:
                preset_row = random.randint(2, 6)
            clown_payload = {"day": target_day, "row": preset_row}
            conn.execute("""
                INSERT INTO campaign_user_status_effects (user_id, campaign_id, effect_key, effect_value, applied_at, active)
                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, TRUE)
                ON CONFLICT (user_id, campaign_id, effect_key)
                DO UPDATE SET effect_value = EXCLUDED.effect_value,
                              applied_at = EXCLUDED.applied_at,
                              active = TRUE
            """, (user_id, campaign_id, "send_in_the_clown", json.dumps(clown_payload)))
        elif clown_row and clown_row[0]:
            try:
                clown_payload = json.loads(clown_row[0])
            except json.JSONDecodeError:
                clown_payload = {"day": target_day, "row": random.randint(2, 6)}
                conn.execute("""
                    UPDATE campaign_user_status_effects
                    SET effect_value = %s, applied_at = CURRENT_TIMESTAMP
                    WHERE user_id = %s AND campaign_id = %s AND effect_key = %s
                """, (json.dumps(clown_payload), user_id, campaign_id, "send_in_the_clown"))

        if clown_payload and clown_payload.get("day") != target_day:
            clown_payload = {"day": target_day, "row": random.randint(2, 6)}
            conn.execute("""
                UPDATE campaign_user_status_effects
                SET effect_value = %s, applied_at = CURRENT_TIMESTAMP
                WHERE user_id = %s AND campaign_id = %s AND effect_key = %s
            """, (json.dumps(clown_payload), user_id, campaign_id, "send_in_the_clown"))

        seal_payload = active_effects.get("seal_of_silence", {}).get("value")
        if seal_payload and current_row < 2 and seal_payload in guess:
            raise HTTPException(status_code=400, detail="That letter is sealed for the first two guesses.")

        edict_payload = active_effects.get("edict_of_compulsion", {}).get("value")
        if edict_payload and current_row == 0 and guess != edict_payload:
            raise HTTPException(status_code=400, detail="Your first guess must follow the edict.")

        voidbrand_payload = active_effects.get("voidbrand", {}).get("value")
        if voidbrand_payload and current_row == 0:
            banned_letters = set(voidbrand_payload)
            if any(letter in banned_letters for letter in guess):
                raise HTTPException(status_code=400, detail="That word is forbidden for the first guess.")

        if current_row == 0:
            conn.execute("""
                INSERT INTO campaign_first_guesses (user_id, campaign_id, date, word)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, campaign_id, date) DO NOTHING
            """, (user_id, campaign_id, target_date_str, guess))

        clown_triggered = False
        if clown_payload and isinstance(clown_payload.get("row"), int):
            if current_row == max(0, int(clown_payload["row"]) - 1):
                clown_triggered = True
                conn.execute("""
                    UPDATE campaign_user_status_effects
                    SET active = FALSE
                    WHERE user_id = %s AND campaign_id = %s AND effect_key = %s
                """, (user_id, campaign_id, "send_in_the_clown"))

        guesses[current_row] = list(guess)

        if not is_admin_flag:
            # Increment total guesses
            conn.execute("""
                UPDATE users
                SET total_guesses = total_guesses + 1
                WHERE id = %s
            """, (user_id,))

        results_data[current_row] = result

        for i in range(5):
            letter = guess[i]
            current = letter_status.get(letter, None)
            if result[i] == "correct":
                letter_status[letter] = "correct"
            elif result[i] == "present" and current != "correct":
                letter_status[letter] = "present"
            elif not current:
                letter_status[letter] = "absent"

        # Double Down logic
        dd_row = conn.execute("""
            SELECT double_down_activated
            FROM campaign_members
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()
        is_double_down = dd_row and dd_row[0] == 1 and target_day == current_day
        max_rows = 3 if is_double_down else 6
        if "executioners_cut" in active_effects:
            max_rows = max(1, max_rows - 1)
        new_game_over = correct or current_row + 1 == max_rows

        score_to_add = 0
        if correct:
            if not is_admin_flag:
                conn.execute("""
                    UPDATE users
                    SET correct_guesses = correct_guesses + 1
                    WHERE id = %s
                """, (user_id,))

            score_to_add = points_by_row.get(current_row, 0)

            if is_double_down:
                if current_row <= 2:
                    score_to_add *= 2
                    conn.execute("""
                        UPDATE campaign_members
                        SET score = score + %s,
                            double_down_activated = 0,
                            double_down_used_week = 1,
                            double_down_date = %s
                        WHERE user_id = %s AND campaign_id = %s
                    """, (score_to_add, target_date_str, user_id, campaign_id))
                else:
                    conn.execute("""
                        UPDATE campaign_members
                        SET double_down_activated = 0,
                            double_down_used_week = 1,
                            double_down_date = %s
                        WHERE user_id = %s AND campaign_id = %s
                    """, (target_date_str, user_id, campaign_id))
            else:
                conn.execute("""
                    UPDATE campaign_members
                    SET score = score + %s
                    WHERE user_id = %s AND campaign_id = %s
                """, (score_to_add, user_id, campaign_id))

            conn.execute("""
                INSERT INTO campaign_daily_troops (user_id, campaign_id, date, troops)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, campaign_id, date) DO UPDATE
                SET troops = campaign_daily_troops.troops + EXCLUDED.troops
            """, (user_id, campaign_id, target_date_str, score_to_add))

        elif new_game_over and is_double_down:
            conn.execute("""
                UPDATE campaign_members
                SET double_down_activated = 0,
                    double_down_used_week = 1,
                    double_down_date = %s
                WHERE user_id = %s AND campaign_id = %s
            """, (target_date_str, user_id, campaign_id))

        # Save to guesses table
        conn.execute("""
            INSERT INTO campaign_guesses (user_id, campaign_id, word, date)
            VALUES (%s, %s, %s, %s)
        """, (user_id, campaign_id, guess, target_date_str))

        # Save full state
        conn.execute("""
            INSERT INTO campaign_guess_states (
                user_id, campaign_id, date,
                guesses, results, letter_status, current_row, game_over
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, campaign_id, date) DO UPDATE
            SET guesses = EXCLUDED.guesses,
                results = EXCLUDED.results,
                letter_status = EXCLUDED.letter_status,
                current_row = EXCLUDED.current_row,
                game_over = EXCLUDED.game_over
        """, (
            user_id, campaign_id, target_date_str,
            json.dumps(guesses),
            json.dumps(results_data),
            json.dumps(letter_status),
            current_row + 1,
            int(new_game_over)
        ))

        conn.execute("""
            INSERT INTO campaign_daily_progress (
                user_id, campaign_id, date, completed
            ) VALUES (%s, %s, %s, %s)
            ON CONFLICT (campaign_id, user_id, date) DO UPDATE
            SET completed = EXCLUDED.completed
        """, (
            user_id,
            campaign_id,
            target_date_str,
            int(new_game_over)
        ))

        if new_game_over:
            new_streak = None
            if target_day == current_day:
                new_streak = update_campaign_streak(
                    conn, user_id, campaign_id, target_date_str, track_stats=not is_admin_flag
                )
            if correct:
                coins_to_add = coins_by_row.get(current_row, 4)
            else:
                coins_to_add = 8
            new_coin_balance = update_campaign_coins(conn, user_id, campaign_id, target_date_str, coins_to_add)

            guesses_used = (current_row + 1) if correct else max_rows
            used_double_down = 1 if is_double_down else 0
            double_down_success = 1 if (is_double_down and correct and current_row <= 2) else 0
            base_troops = points_by_row.get(current_row, 0)
            double_down_bonus = (score_to_add - base_troops) if double_down_success else 0
            troops_earned = score_to_add if correct else 0

            first_guess_row = conn.execute("""
                SELECT word
                FROM campaign_first_guesses
                WHERE user_id = %s AND campaign_id = %s AND date = %s
            """, (user_id, campaign_id, target_date_str)).fetchone()
            first_guess_word = first_guess_row[0] if first_guess_row else None
            completed_at = datetime.now(ZoneInfo("America/Chicago"))

            conn.execute("""
                INSERT INTO campaign_user_daily_results (
                    user_id,
                    campaign_id,
                    date,
                    word,
                    guesses_used,
                    solved,
                    first_guess_word,
                    used_double_down,
                    double_down_success,
                    double_down_bonus_troops,
                    troops_earned,
                    coins_earned,
                    completed_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, campaign_id, date) DO NOTHING
            """, (
                user_id,
                campaign_id,
                target_date_str,
                secret,
                guesses_used,
                int(correct),
                first_guess_word,
                used_double_down,
                double_down_success,
                double_down_bonus,
                troops_earned,
                coins_to_add,
                completed_at
            ))

            if not is_admin_flag:
                conn.execute("""
                    INSERT INTO global_word_stats (
                        word,
                        attempts,
                        solves,
                        fails,
                        first_seen,
                        last_seen
                    ) VALUES (%s, 1, %s, %s, %s, %s)
                    ON CONFLICT (word) DO UPDATE
                    SET attempts = global_word_stats.attempts + 1,
                        solves = global_word_stats.solves + EXCLUDED.solves,
                        fails = global_word_stats.fails + EXCLUDED.fails,
                        last_seen = EXCLUDED.last_seen
                """, (
                    secret,
                    1 if correct else 0,
                    0 if correct else 1,
                    target_date_str,
                    target_date_str
                ))

            total_days_played_new = None
            if not is_admin_flag:
                stats_row = conn.execute("""
                    SELECT total_solves, total_fails, total_guesses_on_solves,
                           total_days_played, double_down_used, double_down_success,
                           double_down_bonus_troops, coins_earned_total
                    FROM user_campaign_stats
                    WHERE user_id = %s AND campaign_id = %s
                """, (user_id, campaign_id)).fetchone()

                solves_add = 1 if correct else 0
                fails_add = 0 if correct else 1
                guesses_on_solves_add = guesses_used if correct else 0
                dd_used_add = used_double_down
                dd_success_add = double_down_success
                dd_bonus_add = double_down_bonus

                if stats_row:
                    total_solves, total_fails, total_guesses_on_solves, total_days_played, dd_used, dd_success, dd_bonus, coins_total = stats_row
                    total_days_played_new = total_days_played + 1
                    conn.execute("""
                        UPDATE user_campaign_stats
                        SET total_solves = %s,
                            total_fails = %s,
                            total_guesses_on_solves = %s,
                            total_days_played = %s,
                            double_down_used = %s,
                            double_down_success = %s,
                            double_down_bonus_troops = %s,
                            coins_earned_total = %s
                        WHERE user_id = %s AND campaign_id = %s
                    """, (
                        total_solves + solves_add,
                        total_fails + fails_add,
                        total_guesses_on_solves + guesses_on_solves_add,
                        total_days_played_new,
                        dd_used + dd_used_add,
                        dd_success + dd_success_add,
                        dd_bonus + dd_bonus_add,
                        coins_total + coins_to_add,
                        user_id,
                        campaign_id
                    ))
                else:
                    total_days_played_new = 1
                    conn.execute("""
                        INSERT INTO user_campaign_stats (
                            user_id,
                            campaign_id,
                            total_solves,
                            total_fails,
                            total_guesses_on_solves,
                            total_days_played,
                            double_down_used,
                            double_down_success,
                            double_down_bonus_troops,
                            coins_earned_total
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        user_id,
                        campaign_id,
                        solves_add,
                        fails_add,
                        guesses_on_solves_add,
                        1,
                        dd_used_add,
                        dd_success_add,
                        dd_bonus_add,
                        coins_to_add
                    ))

                if correct:
                    if guesses_used == 1:
                        award_accolade(conn, campaign_id, user_id, "ace", target_date_str)
                    elif guesses_used in (2, 3):
                        award_accolade(conn, campaign_id, user_id, "clutch", target_date_str)
                    elif guesses_used == 6:
                        award_accolade(conn, campaign_id, user_id, "barely_made_it", target_date_str)

                    if guesses_used == 3 and is_lucky_strike(results_data):
                        award_accolade(conn, campaign_id, user_id, "lucky_strike", target_date_str)

                    early, night, late_save = classify_time_accolades(completed_at, target_date)
                    if early:
                        award_accolade(conn, campaign_id, user_id, "early_bird", target_date_str)
                    if night:
                        award_accolade(conn, campaign_id, user_id, "night_owl", target_date_str)
                    if late_save:
                        award_accolade(conn, campaign_id, user_id, "late_save", target_date_str)

                    first_solver_row = conn.execute("""
                        SELECT user_id
                        FROM campaign_user_daily_results
                        WHERE campaign_id = %s AND date = %s AND solved = 1
                        ORDER BY completed_at ASC NULLS LAST, user_id ASC
                        LIMIT 1
                    """, (campaign_id, target_date_str)).fetchone()
                    if first_solver_row and first_solver_row[0] == user_id:
                        award_accolade(conn, campaign_id, user_id, "first_solver", target_date_str)

                    yesterday = (target_date - timedelta(days=1)).strftime("%Y-%m-%d")
                    prev_row = conn.execute("""
                        SELECT solved
                        FROM campaign_user_daily_results
                        WHERE user_id = %s AND campaign_id = %s AND date = %s
                    """, (user_id, campaign_id, yesterday)).fetchone()
                    if prev_row and int(prev_row[0]) == 0:
                        award_accolade(conn, campaign_id, user_id, "comeback", target_date_str)

                    two_days = (target_date - timedelta(days=2)).strftime("%Y-%m-%d")
                    prev_two_row = conn.execute("""
                        SELECT solved
                        FROM campaign_user_daily_results
                        WHERE user_id = %s AND campaign_id = %s AND date = %s
                    """, (user_id, campaign_id, two_days)).fetchone()
                    if prev_row and prev_two_row and int(prev_row[0]) == 0 and int(prev_two_row[0]) == 0:
                        award_accolade(conn, campaign_id, user_id, "iron_will", target_date_str)

                    item_used_row = conn.execute("""
                        SELECT 1
                        FROM campaign_item_events
                        WHERE user_id = %s AND campaign_id = %s AND event_type = 'use'
                          AND DATE(created_at AT TIME ZONE 'America/Chicago') = %s
                        LIMIT 1
                    """, (user_id, campaign_id, target_date_str)).fetchone()
                    if item_used_row and guesses_used <= 3:
                        award_accolade(conn, campaign_id, user_id, "saves_the_day", target_date_str)

                if (
                    HOARDER_THRESHOLD is not None
                    and new_coin_balance is not None
                    and (new_coin_balance - coins_to_add) < HOARDER_THRESHOLD <= new_coin_balance
                ):
                    award_accolade(conn, campaign_id, user_id, "hoarder", target_date_str)

                if total_days_played_new in (7, 30, 100):
                    key = f"veteran_{total_days_played_new}"
                    award_accolade(conn, campaign_id, user_id, key, target_date_str)

                if new_streak == 7:
                    award_accolade(conn, campaign_id, user_id, "perfect_week", target_date_str)
                if new_streak == 10:
                    award_accolade(conn, campaign_id, user_id, "marathon", target_date_str)

        return {
            "result": result,
            "correct": correct,
            "word": secret,
            "clown_triggered": clown_triggered
        }

def activate_double_down(user_id: int, campaign_id: int):
    today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")
    with get_db() as conn:
        row = conn.execute("""
            SELECT double_down_used_week, double_down_activated
            FROM campaign_members
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Campaign membership not found")

        already_used, already_active = row
        if already_used:
            raise HTTPException(status_code=403, detail="Double Down already used this week")
        if already_active:
            raise HTTPException(status_code=403, detail="Double Down already active")

        conn.execute("""
            UPDATE campaign_members
            SET double_down_activated = 1,
                double_down_date = %s
            WHERE user_id = %s AND campaign_id = %s
        """, (today, user_id, campaign_id))

    return {"status": "double down activated"}

def get_campaign_day(campaign_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT start_date, cycle_length FROM campaigns WHERE id = %s",
            (campaign_id,)
        ).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    start_date_str, cycle_length = row
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    today = datetime.now(ZoneInfo("America/Chicago")).date()
    delta = (today - start_date).days

    return {"day": delta + 1, "total": cycle_length}



def get_campaign_progress(campaign_id: int):
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT name,
                   start_date,
                   invite_code,
                   cycle_length,
                   king,
                   ruler_id,
                   ruler_title,
                   COALESCE(is_admin_campaign, FALSE),
                   ruler_background_image_url,
                   ruler_background_image_key
            FROM campaigns
            WHERE id = %s
            """,
            (campaign_id,)
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    name, start_date_str, invite_code, cycle_length, king, ruler_id, ruler_title, is_admin_campaign, ruler_bg_url, ruler_bg_key = row
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    today = datetime.now(ZoneInfo("America/Chicago")).date()
    delta = (today - start_date).days
    ruler_background_image_url = None
    if ruler_bg_key:
        ruler_background_image_url = create_presigned_download(ruler_bg_key)
    elif ruler_bg_url:
        ruler_background_image_url = ruler_bg_url

    return {
        "name": name,
        "day": min(delta + 1, cycle_length),
        "total": cycle_length,
        "invite_code": invite_code,
        "king": king,
        "ruler_id": ruler_id,
        "ruler_title": ruler_title,
        "is_admin_campaign": bool(is_admin_campaign),
        "ruler_background_image_url": ruler_background_image_url
    }

def get_campaign_streak(user_id: int, campaign_id: int):
    with get_db() as conn:
        row = conn.execute("""
            SELECT streak
            FROM campaign_streak_cycle
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()

    return {"streak": row[0] if row else 0}

def get_campaign_coins(user_id: int, campaign_id: int):
    with get_db() as conn:
        row = conn.execute("""
            SELECT coins
            FROM campaign_coins
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()

    return {"coins": row[0] if row else 0}


def get_user_accolades(user_id: int, campaign_id: int):
    with get_db() as conn:
        return {"accolades": list_user_accolades(conn, user_id, campaign_id)}

def get_leaderboard(campaign_id: int):
    today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")

    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT 
                cm.user_id,
                cm.display_name,
                cm.color,
                cm.score,
                COALESCE(dp.completed, 0) as played_today,
                u.profile_image_url,
                u.profile_image_key,
                u.profile_image_thumb_url,
                u.profile_image_thumb_key,
                cm.army_image_url,
                cm.army_image_key,
                cm.army_image_thumb_url,
                cm.army_image_thumb_key,
                cm.army_name
            FROM campaign_members cm
            JOIN users u ON u.id = cm.user_id
            LEFT JOIN campaign_daily_progress dp 
              ON cm.user_id = dp.user_id 
              AND cm.campaign_id = dp.campaign_id 
              AND dp.date = %s
            WHERE cm.campaign_id = %s
            ORDER BY cm.score DESC
            """,
            (today, campaign_id)
        ).fetchall()

    return [
        {
            "user_id": row[0],
            "display_name": row[1],
            "username": row[1],
            "color": row[2],
            "score": row[3],
            "played_today": bool(row[4]),
            "profile_image_full_url": create_presigned_download(row[6]) if row[6] else row[5],
            "profile_image_thumb_url": create_presigned_download(row[8]) if row[8] else row[7] or row[5],
            "profile_image_url": create_presigned_download(row[8]) if row[8] else create_presigned_download(row[6]) if row[6] else row[5],
            "army_image_full_url": create_presigned_download(row[10]) if row[10] else row[9],
            "army_image_thumb_url": create_presigned_download(row[12]) if row[12] else row[11] or row[9],
            "army_image_url": create_presigned_download(row[10]) if row[10] else row[9],
            "army_name": row[13]
        }
        for row in rows
    ]

def get_saved_progress(user_id: int, campaign_id: int, day_override: int | None = None):
    with get_db() as conn:
        _, _, current_day, target_day, target_date = resolve_campaign_day(conn, campaign_id, day_override)
        target_date_str = target_date.strftime("%Y-%m-%d")

        if target_day == current_day:
            # Check if Double Down was activated on a previous day but not completed
            row = conn.execute("""
                SELECT double_down_activated, double_down_date
                FROM campaign_members
                WHERE user_id = %s AND campaign_id = %s
            """, (user_id, campaign_id)).fetchone()

            if row and row[0] == 1 and row[1] and row[1] < target_date_str:
                # Check if player completed the game on that day
                completed = conn.execute("""
                    SELECT completed FROM campaign_daily_progress
                    WHERE user_id = %s AND campaign_id = %s AND date = %s
                """, (user_id, campaign_id, row[1])).fetchone()

                if not completed or not completed[0]:
                    # mark Double Down as used
                    conn.execute("""
                        UPDATE campaign_members
                        SET double_down_activated = 0,
                            double_down_used_week = 1,
                            double_down_date = %s
                        WHERE user_id = %s AND campaign_id = %s
                    """, (target_date_str, user_id, campaign_id))

        # Fetch saved progress
        row = conn.execute("""
            SELECT guesses, results, letter_status, current_row, game_over
            FROM campaign_guess_states
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, target_date_str)).fetchone()
        word_row = conn.execute(
            "SELECT word FROM campaign_words WHERE campaign_id = %s AND day = %s",
            (campaign_id, target_day)
        ).fetchone()
        daily_word = word_row[0] if word_row else None

    if row:
        return {
            "guesses": json.loads(row[0]),
            "results": json.loads(row[1]),
            "letter_status": json.loads(row[2]),
            "current_row": row[3],
            "game_over": bool(row[4]),
            "word": daily_word
        }

    # 🧼 Default fallback for new day/campaign
    return {
        "guesses": [["", "", "", "", ""] for _ in range(6)],
        "results": [None for _ in range(6)],
        "letter_status": {},
        "current_row": 0,
        "game_over": 0,
        "word": daily_word
    }

def handle_campaign_end(campaign_id: int):
    with get_db() as conn:
        # 1. Get standings with campaign + user info
        standings = conn.execute("""
            SELECT 
                cm.user_id,
                cm.score,
                cm.display_name,
                u.first_name,
                u.last_name,
                c.name,
                c.start_date,
                c.cycle_length,
                COALESCE(c.is_admin_campaign, FALSE)
            FROM campaign_members cm
            JOIN users u ON u.id = cm.user_id
            JOIN campaigns c ON c.id = cm.campaign_id
            WHERE cm.campaign_id = %s
            ORDER BY cm.score DESC
        """, (campaign_id,)).fetchall()

        if standings:
            user_id, score, display_name, first_name, last_name, camp_name, start_date_str, cycle_length, is_admin_flag = standings[0]

            # Determine when this “season” ended
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            final_day = start_date + timedelta(days=cycle_length - 1)
            today = datetime.now(ZoneInfo("America/Chicago")).date()

            # If campaign is ended early via API, use today; otherwise use natural final day.
            ended_on = min(today, final_day)

            # Persist reigning king for the next cycle.
            king_name = (display_name or f"{first_name or ''} {last_name or ''}").strip()
            conn.execute("""
                UPDATE campaigns
                SET king = %s,
                    ruler_id = %s,
                    ruler_title = COALESCE(ruler_title, 'Current Ruler')
                WHERE id = %s
            """, (king_name, user_id, campaign_id))

            if not is_admin_flag:
                ended_on_str = ended_on.strftime("%Y-%m-%d")
                for rank_row in standings[:3]:
                    award_accolade(conn, campaign_id, rank_row[0], "top_3", ended_on_str)

                # 1a. Record global high score entries for all members
                for member_user_id, member_score, member_display_name, member_first, member_last, *_ in standings:
                    if not member_score or member_score <= 0:
                        continue
                    account_name = f"{member_first or ''} {member_last or ''}".strip()
                    if member_first and member_last:
                        player_name = account_name
                    else:
                        player_name = (member_display_name or account_name).strip()
                    conn.execute("""
                        INSERT INTO global_high_scores (
                            user_id,
                            campaign_id,
                            player_name,
                            campaign_name,
                            troops,
                            ended_on,
                            campaign_length
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        member_user_id,
                        campaign_id,
                        player_name,
                        camp_name,
                        member_score,
                        ended_on.strftime("%Y-%m-%d"),
                        cycle_length
                    ))

                # 1b. Update winner’s campaign_wins
                conn.execute("""
                    UPDATE users
                    SET campaign_wins = campaign_wins + 1
                    WHERE id = %s
                """, (user_id,))

        # 2. Reset campaign to start over
        today_str = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")
        conn.execute("""
            UPDATE campaigns
            SET start_date = %s,
                ruler_title = NULL
            WHERE id = %s
        """, (today_str, campaign_id))

        # 3. Clear old campaign gameplay data (keep stats tables)
        conn.execute("DELETE FROM campaign_guesses WHERE campaign_id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_guess_states WHERE campaign_id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_daily_progress WHERE campaign_id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_streak_cycle WHERE campaign_id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_daily_recaps WHERE campaign_id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_user_status_effects WHERE campaign_id = %s", (campaign_id,))
        conn.execute("UPDATE campaign_members SET score = 0 WHERE campaign_id = %s", (campaign_id,))
        conn.execute("""
            UPDATE campaign_members
            SET double_down_used_week = 0,
                double_down_activated = 0,
                double_down_date = NULL
            WHERE campaign_id = %s
        """, (campaign_id,))
        conn.execute("DELETE FROM campaign_words WHERE campaign_id = %s", (campaign_id,))
        
        # Reinitialize for a new cycle of # days 
        cycle_length_row = conn.execute(
            "SELECT cycle_length FROM campaigns WHERE id = %s", (campaign_id,)
        ).fetchone()
        cycle_length = cycle_length_row[0] if cycle_length_row else 5
        initialize_campaign_words(campaign_id, cycle_length, conn)

        return {"status": "campaign reset", "new_start_date": today_str}

def update_campaign_ruler(campaign_id: int):
    with get_db() as conn:
        row = conn.execute("""
            SELECT u.id, u.first_name
            FROM campaign_members cm
            JOIN users u ON u.id = cm.user_id
            WHERE cm.campaign_id = %s
            ORDER BY cm.score DESC
            LIMIT 1
        """, (campaign_id,)).fetchone()

        if not row:
            return {"status": "no members"}

        conn.execute("""
            UPDATE campaigns
            SET king = %s,
                ruler_id = %s,
                ruler_title = COALESCE(ruler_title, 'Current Ruler')
            WHERE id = %s
        """, (row[1], row[0], campaign_id))

    return {"status": "ruler updated"}

def update_campaign_ruler_title(user_id: int, campaign_id: int, title: str):
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    if len(title) > 30:
        raise HTTPException(status_code=400, detail="Title must be 30 characters or fewer")

    with get_db() as conn:
        row = conn.execute(
            """
            SELECT ruler_id
            FROM campaigns
            WHERE id = %s
            """,
            (campaign_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Campaign not found")

        ruler_id = row[0]
        is_admin_row = conn.execute(
            "SELECT COALESCE(is_admin, FALSE) FROM users WHERE id = %s",
            (user_id,)
        ).fetchone()
        is_admin = bool(is_admin_row[0]) if is_admin_row else False
        if not is_admin and ruler_id != user_id:
            raise HTTPException(status_code=403, detail="Only the current ruler can edit this title")

        conn.execute("""
            UPDATE campaigns
            SET ruler_title = %s
            WHERE id = %s
        """, (title, campaign_id))

    return {"status": "updated", "ruler_title": title}

def update_campaign_name(campaign_id: int, requester_id: int, name: str):
    cleaned = (name or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Campaign name cannot be empty")

    with get_db() as conn:
        owner_row = conn.execute(
            "SELECT owner_id FROM campaigns WHERE id = %s",
            (campaign_id,)
        ).fetchone()
        if not owner_row:
            raise HTTPException(status_code=404, detail="Campaign not found")
        if owner_row[0] != requester_id:
            raise HTTPException(status_code=403, detail="Only the campaign owner can rename this campaign")

        conn.execute(
            "UPDATE campaigns SET name = %s WHERE id = %s",
            (cleaned, campaign_id)
        )

    return {"status": "updated", "name": cleaned}


def has_campaign_finished_for_day(campaign_id: int):
    with get_db() as conn:
        # Total members
        total_members = conn.execute("""
            SELECT COUNT(*) FROM campaign_members WHERE campaign_id = %s
        """, (campaign_id,)).fetchone()[0]

        # Total who completed today
        today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")
        finished_today = conn.execute("""
            SELECT COUNT(*) FROM campaign_daily_progress
            WHERE campaign_id = %s AND date = %s AND completed = 1
        """, (campaign_id, today)).fetchone()[0]

        return finished_today >= total_members

def delete_campaign(campaign_id: int, requester_id: int):
    with get_db() as conn:
        owner_check = conn.execute("SELECT owner_id FROM campaigns WHERE id = %s", (campaign_id,)).fetchone()
        if not owner_check or owner_check[0] != requester_id:
            raise HTTPException(status_code=403, detail="Only the campaign owner can delete this campaign")

        conn.execute("DELETE FROM campaigns WHERE id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_members WHERE campaign_id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_guesses WHERE campaign_id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_guess_states WHERE campaign_id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_daily_progress WHERE campaign_id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_words WHERE campaign_id = %s", (campaign_id,)) 
        return {"status": "deleted"}


def kick_player_from_campaign(campaign_id: int, target_user_id: int, requester_id: int):
    with get_db() as conn:
        owner_row = conn.execute(
            "SELECT owner_id FROM campaigns WHERE id = %s",
            (campaign_id,)
        ).fetchone()
        if not owner_row:
            raise HTTPException(status_code=404, detail="Campaign not found")

        owner_id = owner_row[0]
        if owner_id != requester_id:
            raise HTTPException(status_code=403, detail="Only the campaign owner can kick players")

        if target_user_id == owner_id:
            raise HTTPException(status_code=403, detail="Owner cannot be removed from their own campaign")

        # Ensure target is actually a member of this campaign
        member_exists = conn.execute(
            "SELECT 1 FROM campaign_members WHERE campaign_id = %s AND user_id = %s",
            (campaign_id, target_user_id)
        ).fetchone()
        if not member_exists:
            raise HTTPException(status_code=404, detail="Member not found in this campaign")

        result = conn.execute(
            "DELETE FROM campaign_members WHERE campaign_id = %s AND user_id = %s",
            (campaign_id, target_user_id)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Member already removed")

        # Optional: clean up any per-user campaign state
        conn.execute("DELETE FROM campaign_guesses WHERE campaign_id = %s AND user_id = %s", (campaign_id, target_user_id))
        conn.execute("DELETE FROM campaign_guess_states WHERE campaign_id = %s AND user_id = %s", (campaign_id, target_user_id))
        conn.execute("DELETE FROM campaign_daily_progress WHERE campaign_id = %s AND user_id = %s", (campaign_id, target_user_id))

        return {"status": "kicked"}


def get_campaigns_by_owner(owner_id: int):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT id, name FROM campaigns WHERE owner_id = %s
        """, (owner_id,)).fetchall()

    return [{"id": row[0], "name": row[1]} for row in rows]

def get_campaign_members(campaign_id: int, requester_id: int):
    with get_db() as conn:
        owner = conn.execute(
            "SELECT owner_id FROM campaigns WHERE id = %s", 
            (campaign_id,)
        ).fetchone()

        if not owner or owner[0] != requester_id:
            raise HTTPException(status_code=403, detail="You are not the owner of this campaign")

        rows = conn.execute("""
            SELECT u.id, u.first_name || ' ' || u.last_name
            FROM campaign_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.campaign_id = %s AND u.id != %s
        """, (campaign_id, requester_id)).fetchall()

        return [{"user_id": r[0], "name": r[1]} for r in rows]

def get_self_member(campaign_id: int, user_id: int):
    today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")
    with get_db() as conn:
        row = conn.execute("""
            SELECT cm.display_name,
                   cm.color,
                   cm.double_down_activated,
                   cm.double_down_used_week,
                   cm.double_down_date,
                   COALESCE(dp.completed, 0) as daily_completed,
                   cm.army_image_url,
                   cm.army_image_key,
                   cm.army_image_thumb_url,
                   cm.army_image_thumb_key,
                   u.profile_image_url,
                   u.profile_image_key,
                   u.profile_image_thumb_url,
                   u.profile_image_thumb_key,
                   cm.army_name
            FROM campaign_members cm
            JOIN users u ON u.id = cm.user_id
            LEFT JOIN campaign_daily_progress dp
              ON dp.user_id = cm.user_id
             AND dp.campaign_id = cm.campaign_id
             AND dp.date = %s
            WHERE cm.campaign_id = %s AND cm.user_id = %s
        """, (today, campaign_id, user_id)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Membership not found")

        army_url = create_presigned_download(row[7]) if row[7] else row[6]
        army_thumb_url = create_presigned_download(row[9]) if row[9] else row[8] or row[6]
        profile_url = create_presigned_download(row[11]) if row[11] else row[10]
        profile_thumb_url = create_presigned_download(row[13]) if row[13] else row[12] or row[10]

        return {
            "display_name": row[0],
            "color": row[1],
            "double_down_activated": row[2],
            "double_down_used_week": row[3],
            "double_down_date": row[4],
            "daily_completed": row[5],
            "army_image_url": army_url,
            "army_image_full_url": army_url,
            "army_image_thumb_url": army_thumb_url,
            "profile_image_url": profile_url,
            "profile_image_full_url": profile_url,
            "profile_image_thumb_url": profile_thumb_url,
            "army_name": row[14]
        }

def get_targetable_members(campaign_id: int, requester_id: int):
    with get_db() as conn:
        member_row = conn.execute("""
            SELECT 1
            FROM campaign_members
            WHERE campaign_id = %s AND user_id = %s
        """, (campaign_id, requester_id)).fetchone()
        if not member_row:
            raise HTTPException(status_code=403, detail="You are not a member of this campaign")

        rows = conn.execute("""
            SELECT user_id, display_name, color
            FROM campaign_members
            WHERE campaign_id = %s AND user_id != %s
            ORDER BY display_name
        """, (campaign_id, requester_id)).fetchall()

        return [{"user_id": r[0], "display_name": r[1], "color": r[2]} for r in rows]

def get_targetable_members_with_item_status(campaign_id: int, requester_id: int, item_key: str):
    with get_db() as conn:
        member_row = conn.execute("""
            SELECT 1
            FROM campaign_members
            WHERE campaign_id = %s AND user_id = %s
        """, (campaign_id, requester_id)).fetchone()
        if not member_row:
            raise HTTPException(status_code=403, detail="You are not a member of this campaign")

        item = get_item(item_key)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        _, _, _, _, target_date = resolve_campaign_day(conn, campaign_id, None)
        effective_on = (target_date + timedelta(days=1)).strftime("%Y-%m-%d")

        exclusive_keys = set(item.get("exclusive_with", []))
        exclusive_keys.add(item_key)

        blocked = set()
        if item.get("exclusive_all"):
            blocked_rows = conn.execute("""
                SELECT target_user_id
                FROM campaign_item_events
                WHERE campaign_id = %s
                  AND event_type = %s
                  AND (details::json->>'effective_on') = %s
                  AND target_user_id IS NOT NULL
            """, (campaign_id, "use", effective_on)).fetchall()
            blocked = {row[0] for row in blocked_rows}
        else:
            combined_keys = set(exclusive_keys)
            combined_keys.update(EXCLUSIVE_ALL_KEYS)
            if combined_keys:
                blocked_rows = conn.execute("""
                    SELECT target_user_id
                    FROM campaign_item_events
                    WHERE campaign_id = %s
                      AND item_key = ANY(%s)
                      AND event_type = %s
                      AND (details::json->>'effective_on') = %s
                      AND target_user_id IS NOT NULL
                """, (campaign_id, list(combined_keys), "use", effective_on)).fetchall()
                blocked = {row[0] for row in blocked_rows}

        rows = conn.execute("""
            SELECT user_id, display_name, color
            FROM campaign_members
            WHERE campaign_id = %s AND user_id != %s
            ORDER BY display_name
        """, (campaign_id, requester_id)).fetchall()

        return [
            {
                "user_id": r[0],
                "display_name": r[1],
                "color": r[2],
                "blocked": r[0] in blocked
            }
            for r in rows
        ]

def get_active_target_effects(user_id: int, campaign_id: int):
    with get_db() as conn:
        _, _, _, target_day, target_date = resolve_campaign_day(conn, campaign_id, None)
        target_date_str = target_date.strftime("%Y-%m-%d")

        rows = conn.execute("""
            SELECT item_key, details
            FROM campaign_item_events
            WHERE campaign_id = %s
              AND target_user_id = %s
              AND event_type = %s
              AND (details::json->>'effective_on') = %s
        """, (campaign_id, user_id, "use", target_date_str)).fetchall()

        effects = []
        for row in rows:
            payload = None
            if row[1]:
                try:
                    payload = json.loads(row[1])
                except json.JSONDecodeError:
                    payload = {"raw": row[1]}
            effects.append({"item_key": row[0], "details": payload})

    return {"day": target_day, "effects": effects}

def get_current_status_effects(user_id: int, campaign_id: int):
    with get_db() as conn:
        _, _, _, target_day, _ = resolve_campaign_day(conn, campaign_id, None)
        now_ct = datetime.now(ZoneInfo("America/Chicago"))
        rows = conn.execute("""
            SELECT effect_key, effect_value, expires_at
            FROM campaign_user_status_effects
            WHERE user_id = %s AND campaign_id = %s AND active = TRUE
        """, (user_id, campaign_id)).fetchall()

    effects = []
    for row in rows:
        effect_key, effect_value, expires_at = row
        if expires_at:
            compare_now = now_ct if expires_at.tzinfo else now_ct.replace(tzinfo=None)
            if expires_at < compare_now:
                continue
        payload = None
        if effect_value:
            try:
                payload = json.loads(effect_value)
            except json.JSONDecodeError:
                payload = {"raw": effect_value}

        if effect_key in ("oracle_whisper", "cartographers_insight"):
            if not payload or payload.get("day") != target_day:
                continue

        effects.append({
            "effect_key": effect_key,
            "payload": payload
        })

    return {"effects": effects}

def redeem_candle_of_mercy(user_id: int, campaign_id: int):
    with get_db() as conn:
        _, _, _, target_day, target_date = resolve_campaign_day(conn, campaign_id, None)
        target_date_str = target_date.strftime("%Y-%m-%d")

        status_row = conn.execute("""
            SELECT effect_value
            FROM campaign_user_status_effects
            WHERE user_id = %s AND campaign_id = %s AND effect_key = %s AND active = TRUE
        """, (user_id, campaign_id, "candle_of_mercy")).fetchone()
        if not status_row:
            raise HTTPException(status_code=400, detail="Candle of Mercy is not available")

        result_row = conn.execute("""
            SELECT solved
            FROM campaign_user_daily_results
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, target_date_str)).fetchone()
        if not result_row or result_row[0] == 1:
            raise HTTPException(status_code=400, detail="Candle of Mercy can only be used after a failed day")

        redeemed_row = conn.execute("""
            SELECT 1
            FROM campaign_item_events
            WHERE user_id = %s
              AND campaign_id = %s
              AND item_key = %s
              AND event_type = %s
              AND (details::json->>'date') = %s
        """, (user_id, campaign_id, "candle_of_mercy", "redeem", target_date_str)).fetchone()
        if redeemed_row:
            raise HTTPException(status_code=400, detail="Candle of Mercy already redeemed today")

        try:
            payload = json.loads(status_row[0]) if status_row[0] else {}
            bonus = int(payload.get("bonus_troops_on_fail", 10))
        except (json.JSONDecodeError, ValueError, TypeError):
            bonus = 10

        conn.execute("""
            UPDATE campaign_members
            SET score = score + %s
            WHERE user_id = %s AND campaign_id = %s
        """, (bonus, user_id, campaign_id))

        conn.execute("""
            INSERT INTO campaign_daily_troops (user_id, campaign_id, date, troops)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, campaign_id, date) DO UPDATE
            SET troops = campaign_daily_troops.troops + EXCLUDED.troops
        """, (user_id, campaign_id, target_date_str, bonus))

        conn.execute("""
            UPDATE campaign_user_daily_results
            SET troops_earned = troops_earned + %s
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (bonus, user_id, campaign_id, target_date_str))

        log_details = json.dumps({"bonus": bonus, "date": target_date_str})
        conn.execute("""
            INSERT INTO campaign_item_events (user_id, campaign_id, item_key, event_type, details)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, campaign_id, "candle_of_mercy", "redeem", log_details))

        conn.execute("""
            UPDATE campaign_user_status_effects
            SET active = FALSE
            WHERE user_id = %s AND campaign_id = %s AND effect_key = %s
        """, (user_id, campaign_id, "candle_of_mercy"))

    return {"bonus": bonus}

def update_campaign_member(campaign_id: int, user_id: int, display_name: str, color: str):
    cleaned_name = (display_name or "").strip()
    with get_db() as conn:
        result = conn.execute("""
            UPDATE campaign_members
            SET display_name = %s, color = %s
            WHERE user_id = %s AND campaign_id = %s
        """, (display_name, color, user_id, campaign_id))

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Campaign membership not found")

        # If the member is the current ruler, keep the campaign king name in sync.
        is_ruler = conn.execute(
            "SELECT 1 FROM campaigns WHERE id = %s AND ruler_id = %s",
            (campaign_id, user_id)
        ).fetchone()
        if is_ruler:
            if not cleaned_name:
                name_row = conn.execute(
                    "SELECT first_name, last_name FROM users WHERE id = %s",
                    (user_id,)
                ).fetchone()
                if name_row:
                    cleaned_name = f"{name_row[0] or ''} {name_row[1] or ''}".strip()
            if cleaned_name:
                conn.execute(
                    "UPDATE campaigns SET king = %s WHERE id = %s",
                    (cleaned_name, campaign_id)
                )

        return {"status": "updated", "display_name": display_name, "color": color}
    
def get_global_leaderboard(limit: int = 10):
    limit = max(1, min(int(limit), 100))
    with get_db() as conn:
        # Ensure table exists (in case migration missed it)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS global_high_scores (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                campaign_id INTEGER,
                player_name TEXT NOT NULL,
                campaign_name TEXT NOT NULL,
                troops INTEGER NOT NULL,
                ended_on TEXT NOT NULL,
                campaign_length INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("ALTER TABLE global_high_scores ADD COLUMN IF NOT EXISTS campaign_length INTEGER")
        # ✅ 1) Seed dummy data if the table is empty
        count = conn.execute("SELECT COUNT(*) FROM global_high_scores").fetchone()[0]

        if count == 0:
            conn.executemany("""
                INSERT INTO global_high_scores (
                    user_id,
                    campaign_id,
                    player_name,
                    campaign_name,
                    troops,
                    ended_on,
                    campaign_length
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, [
                (None, None, "Sir Lexicon",    "Season of Shadows",      150, "2025-01-01", 7),
                (None, None, "Count Vowel",    "Vowels of Valor",        130, "2025-02-10", 5),
                (None, None, "Duke Consonant", "Consonant Crusade",      120, "2025-03-05", 3),
                (None, None, "Baron Bigram",   "Siege of Syllables",     110, "2025-04-18", 7),
                (None, None, "Lady Syllable",  "Whispers of Wordsmiths", 100, "2025-05-22", 5),
                (None, None, "Lord Trigram",    "Trigram Trials",         95, "2025-06-15", 3),
                (None, None, "Knight Rhyme",   "Rhymes of Ruin",          90, "2025-07-03", 7),
                (None, None, "Dame Diction",   "Diction Dominion",        85, "2025-08-09", 5),
                (None, None, "Countess Clue",  "Clue of Crowns",          80, "2025-09-12", 3),
                (None, None, "Viscount Verb",  "Verbs of Valor",          75, "2025-10-01", 5),
            ])
            conn.commit()

        # ✅ 2) Pull the top 10 scores of all time from the Hall of Fame
        rows = conn.execute("""
            SELECT 
                player_name,
                campaign_name,
                troops,
                ended_on,
                campaign_length
            FROM global_high_scores
            ORDER BY troops DESC, ended_on DESC
            LIMIT %s
        """, (limit,)).fetchall()

    # ✅ 3) Shape for the frontend
    return [
        {
            "player_name": row[0],
            "campaign_name": row[1],
            "best_troops": row[2],
            "ended_on": row[3],
            "campaign_length": row[4]
        }
        for row in rows
    ]

def get_shop_catalog():
    return [
        {k: v for k, v in item.items() if k != "handler"}
        for item in ITEM_CATALOG
    ]

def _get_shop_day(conn, campaign_id: int):
    _, _, _, _, target_date = resolve_campaign_day(conn, campaign_id, None)
    return target_date.strftime("%Y-%m-%d")

def _get_or_create_shop_rotation(conn, user_id: int, campaign_id: int, date_str: str):
    rotation_row = conn.execute("""
        SELECT items
        FROM campaign_shop_rotation
        WHERE user_id = %s AND campaign_id = %s AND date = %s
    """, (user_id, campaign_id, date_str)).fetchone()
    if rotation_row and rotation_row[0]:
        if isinstance(rotation_row[0], list):
            return rotation_row[0]
        try:
            return json.loads(rotation_row[0])
        except (json.JSONDecodeError, TypeError):
            pass

    catalog_keys = [item["key"] for item in ITEM_CATALOG]
    if len(catalog_keys) <= 6:
        selection = catalog_keys
    else:
        selection = random.sample(catalog_keys, 6)
    conn.execute("""
        INSERT INTO campaign_shop_rotation (user_id, campaign_id, date, items)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, campaign_id, date)
        DO UPDATE SET items = EXCLUDED.items, updated_at = CURRENT_TIMESTAMP
    """, (user_id, campaign_id, date_str, json.dumps(selection)))
    return selection

def get_shop_state(user_id: int, campaign_id: int):
    with get_db() as conn:
        is_admin_flag = is_admin_campaign(conn, campaign_id)
        coins_row = conn.execute("""
            SELECT coins
            FROM campaign_coins
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()
        coins = coins_row[0] if coins_row else 0

        inv_rows = conn.execute("""
            SELECT item_key, quantity
            FROM campaign_user_items
            WHERE user_id = %s AND campaign_id = %s
            ORDER BY item_key
        """, (user_id, campaign_id)).fetchall()
        inventory = [{"item_key": r[0], "quantity": r[1]} for r in inv_rows]

        effect_rows = conn.execute("""
            SELECT effect_key, effect_value, applied_at, expires_at
            FROM campaign_user_status_effects
            WHERE user_id = %s AND campaign_id = %s AND active = TRUE
            ORDER BY applied_at DESC
        """, (user_id, campaign_id)).fetchall()
        status_effects = [
            {
                "effect_key": r[0],
                "effect_value": r[1],
                "applied_at": r[2].isoformat() if r[2] else None,
                "expires_at": r[3].isoformat() if r[3] else None
            }
            for r in effect_rows
        ]

        today_str = _get_shop_day(conn, campaign_id)
        log_details = json.dumps({"date": today_str})
        conn.execute("""
            INSERT INTO campaign_shop_log (user_id, campaign_id, event_type, details)
            VALUES (%s, %s, %s, %s)
        """, (user_id, campaign_id, "open", log_details))

        if not is_admin_flag and SHOP_REGULAR_THRESHOLD:
            open_count = conn.execute("""
                SELECT COUNT(*)
                FROM campaign_shop_log
                WHERE user_id = %s AND campaign_id = %s AND event_type = %s
                  AND (
                    (details::jsonb ? 'date' AND details::jsonb->>'date' = %s)
                    OR DATE(created_at AT TIME ZONE 'America/Chicago') = %s
                  )
            """, (user_id, campaign_id, "open", today_str, today_str)).fetchone()[0]
            if open_count >= SHOP_REGULAR_THRESHOLD:
                award_accolade(conn, campaign_id, user_id, "shop_regular", today_str)

        log_rows = conn.execute("""
            SELECT event_type, item_key, details, created_at
            FROM campaign_shop_log
            WHERE user_id = %s AND campaign_id = %s
            ORDER BY created_at DESC
            LIMIT 20
        """, (user_id, campaign_id)).fetchall()
        shop_log = []
        for r in log_rows:
            details = None
            if r[2]:
                try:
                    details = json.loads(r[2])
                except json.JSONDecodeError:
                    details = {"raw": r[2]}
            shop_log.append({
                "event_type": r[0],
                "item_key": r[1],
                "details": details,
                "created_at": r[3].isoformat() if r[3] else None
            })

        purchased_rows = conn.execute("""
            SELECT item_key
            FROM campaign_shop_log
            WHERE user_id = %s
              AND campaign_id = %s
              AND event_type = %s
              AND (
                (details::jsonb ? 'date' AND details::jsonb->>'date' = %s)
                OR DATE(created_at AT TIME ZONE 'America/Chicago') = %s
              )
        """, (user_id, campaign_id, "purchase", today_str, today_str)).fetchall()
        purchased_items = [row[0] for row in purchased_rows if row[0]]

        rotation_keys = _get_or_create_shop_rotation(conn, user_id, campaign_id, today_str)
        catalog = {item["key"]: item for item in get_shop_catalog()}
        rotated_items = [catalog[key] for key in rotation_keys if key in catalog]

    return {
        "coins": coins,
        "items": rotated_items,
        "catalog": list(catalog.values()),
        "inventory": inventory,
        "status_effects": status_effects,
        "shop_log": shop_log,
        "purchased_today": bool(purchased_items),
        "purchased_item_keys": purchased_items,
        "can_reshuffle": not purchased_items
    }

def purchase_item(user_id: int, campaign_id: int, item_key: str):
    item = get_item(item_key)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    with get_db() as conn:
        is_admin_flag = is_admin_campaign(conn, campaign_id)
        today_str = _get_shop_day(conn, campaign_id)
        purchased_row = conn.execute("""
            SELECT 1
            FROM campaign_shop_log
            WHERE user_id = %s
              AND campaign_id = %s
              AND event_type = %s
              AND item_key = %s
              AND (
                (details::jsonb ? 'date' AND details::jsonb->>'date' = %s)
                OR DATE(created_at AT TIME ZONE 'America/Chicago') = %s
              )
            LIMIT 1
        """, (user_id, campaign_id, "purchase", item_key, today_str, today_str)).fetchone()
        if purchased_row:
            raise HTTPException(status_code=400, detail="You already bought this item today.")

        coins_row = conn.execute("""
            SELECT coins
            FROM campaign_coins
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()
        coins = coins_row[0] if coins_row else 0

        if coins < item["cost"]:
            raise HTTPException(status_code=400, detail="Not enough coins")

        conn.execute("""
            UPDATE campaign_coins
            SET coins = coins - %s
            WHERE user_id = %s AND campaign_id = %s
        """, (item["cost"], user_id, campaign_id))

        conn.execute("""
            INSERT INTO store_purchases (user_id, campaign_id, item_key, category, cost)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, campaign_id, item["key"], item["category"], item["cost"]))

        qty_row = conn.execute("""
            INSERT INTO campaign_user_items (user_id, campaign_id, item_key, quantity)
            VALUES (%s, %s, %s, 1)
            ON CONFLICT (user_id, campaign_id, item_key)
            DO UPDATE SET quantity = campaign_user_items.quantity + 1
            RETURNING quantity
        """, (user_id, campaign_id, item["key"])).fetchone()

        log_details = json.dumps({
            "name": item["name"],
            "cost": item["cost"],
            "category": item["category"],
            "date": today_str
        })
        conn.execute("""
            INSERT INTO campaign_shop_log (user_id, campaign_id, event_type, item_key, details)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, campaign_id, "purchase", item["key"], log_details))

        new_quantity = qty_row[0] if qty_row else 1

        if not is_admin_flag and BIG_SPENDER_THRESHOLD:
            spend_total = conn.execute("""
                SELECT COALESCE(SUM(cost), 0)
                FROM store_purchases
                WHERE user_id = %s AND campaign_id = %s
                  AND DATE(purchased_at AT TIME ZONE 'America/Chicago') = %s
            """, (user_id, campaign_id, today_str)).fetchone()[0]
            if spend_total >= BIG_SPENDER_THRESHOLD:
                award_accolade(conn, campaign_id, user_id, "big_spender", today_str)

    return {
        "coins": coins - item["cost"],
        "item": item,
        "quantity": new_quantity
    }

def reshuffle_shop(user_id: int, campaign_id: int, cost: int = 3):
    with get_db() as conn:
        today_str = _get_shop_day(conn, campaign_id)
        purchased_row = conn.execute("""
            SELECT 1
            FROM campaign_shop_log
            WHERE user_id = %s
              AND campaign_id = %s
              AND event_type = %s
              AND (
                (details::jsonb ? 'date' AND details::jsonb->>'date' = %s)
                OR DATE(created_at AT TIME ZONE 'America/Chicago') = %s
              )
            LIMIT 1
        """, (user_id, campaign_id, "purchase", today_str, today_str)).fetchone()
        if purchased_row:
            raise HTTPException(status_code=400, detail="Cannot reshuffle after purchasing today.")

        coins_row = conn.execute("""
            SELECT coins
            FROM campaign_coins
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()
        coins = coins_row[0] if coins_row else 0
        if coins < cost:
            raise HTTPException(status_code=400, detail="Not enough coins to reshuffle.")

        catalog_keys = [item["key"] for item in ITEM_CATALOG]
        if len(catalog_keys) <= 6:
            selection = catalog_keys
        else:
            selection = random.sample(catalog_keys, 6)

        conn.execute("""
            UPDATE campaign_coins
            SET coins = coins - %s
            WHERE user_id = %s AND campaign_id = %s
        """, (cost, user_id, campaign_id))

        conn.execute("""
            INSERT INTO campaign_shop_rotation (user_id, campaign_id, date, items, reshuffles)
            VALUES (%s, %s, %s, %s, 1)
            ON CONFLICT (user_id, campaign_id, date)
            DO UPDATE SET items = EXCLUDED.items,
                          reshuffles = campaign_shop_rotation.reshuffles + 1,
                          updated_at = CURRENT_TIMESTAMP
        """, (user_id, campaign_id, today_str, json.dumps(selection)))

        log_details = json.dumps({"cost": cost, "date": today_str})
        conn.execute("""
            INSERT INTO campaign_shop_log (user_id, campaign_id, event_type, details)
            VALUES (%s, %s, %s, %s)
        """, (user_id, campaign_id, "restock", log_details))

        catalog = {item["key"]: item for item in get_shop_catalog()}
        rotated_items = [catalog[key] for key in selection if key in catalog]

    return {"coins": coins - cost, "items": rotated_items}

def use_item(user_id: int, campaign_id: int, item_key: str, target_user_id, effect_payload: dict | None = None):
    item = get_item(item_key)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    hint_payload = None
    payload_value = None
    payload_type = item.get("payload_type")

    with get_db() as conn:
        _, cycle_length, current_day, target_day, target_date = resolve_campaign_day(conn, campaign_id, None)
        is_admin_flag = is_admin_campaign(conn, campaign_id)
        affects_others = bool(item.get("affects_others"))
        requires_target = bool(item.get("requires_target"))

        if affects_others and requires_target and not target_user_id:
            raise HTTPException(status_code=400, detail="Target required for this item")

        if affects_others and current_day == cycle_length and target_day == current_day:
            raise HTTPException(status_code=400, detail="Cannot use target items on the final day")

        if affects_others and requires_target:
            member_row = conn.execute("""
                SELECT 1
                FROM campaign_members
                WHERE campaign_id = %s AND user_id = %s
            """, (campaign_id, target_user_id)).fetchone()
            if not member_row:
                raise HTTPException(status_code=404, detail="Target not found in campaign")

        qty_row = conn.execute("""
            SELECT quantity
            FROM campaign_user_items
            WHERE user_id = %s AND campaign_id = %s AND item_key = %s
        """, (user_id, campaign_id, item_key)).fetchone()
        qty = qty_row[0] if qty_row else 0
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Item not available")

        if payload_type:
            payload_value = (effect_payload or {}).get("value")
            if payload_value is None:
                raise HTTPException(status_code=400, detail="This item requires a selection before use.")
            payload_value = str(payload_value).strip().lower()
            if payload_type == "letter":
                if len(payload_value) != 1 or not payload_value.isalpha():
                    raise HTTPException(status_code=400, detail="Choose a single letter.")
            elif payload_type == "word":
                if len(payload_value) != 5 or not payload_value.isalpha():
                    raise HTTPException(status_code=400, detail="Choose a valid 5-letter word.")
                if item_key == "voidbrand" and payload_value not in PLAYABLE_WORDS:
                    raise HTTPException(status_code=400, detail="Word must come from the playable word list.")
                if item_key != "voidbrand" and payload_value not in VALID_WORDS:
                    raise HTTPException(status_code=400, detail="Word must be a valid guess.")
            else:
                raise HTTPException(status_code=400, detail="Unsupported payload type.")

        details_payload = {"name": item["name"], "category": item["category"]}
        sender_row = conn.execute("""
            SELECT display_name
            FROM campaign_members
            WHERE campaign_id = %s AND user_id = %s
        """, (campaign_id, user_id)).fetchone()
        if sender_row and sender_row[0]:
            details_payload["sender_name"] = sender_row[0]
        if payload_type:
            details_payload["payload"] = {"type": payload_type, "value": payload_value}
        if affects_others:
            effective_on = (target_date + timedelta(days=1)).strftime("%Y-%m-%d")
            details_payload["effective_on"] = effective_on
            details_payload["delayed"] = True

            if item.get("exclusive_all"):
                conflict_row = conn.execute("""
                    SELECT 1
                    FROM campaign_item_events
                    WHERE campaign_id = %s
                      AND target_user_id = %s
                      AND event_type = %s
                      AND (details::json->>'effective_on') = %s
                    LIMIT 1
                """, (campaign_id, target_user_id, "use", effective_on)).fetchone()
                if conflict_row:
                    raise HTTPException(status_code=400, detail="Target already has a queued effect for that day")
            elif EXCLUSIVE_ALL_KEYS:
                conflict_row = conn.execute("""
                    SELECT 1
                    FROM campaign_item_events
                    WHERE campaign_id = %s
                      AND target_user_id = %s
                      AND item_key = ANY(%s)
                      AND event_type = %s
                      AND (details::json->>'effective_on') = %s
                    LIMIT 1
                """, (campaign_id, target_user_id, list(EXCLUSIVE_ALL_KEYS), "use", effective_on)).fetchone()
                if conflict_row:
                    raise HTTPException(status_code=400, detail="Target already has a queued effect for that day")

            exclusive_keys = set(item.get("exclusive_with", []))
            exclusive_keys.add(item_key)
            if exclusive_keys:
                conflict_row = conn.execute("""
                    SELECT 1
                    FROM campaign_item_events
                    WHERE campaign_id = %s
                      AND target_user_id = %s
                      AND item_key = ANY(%s)
                      AND event_type = %s
                      AND (details::json->>'effective_on') = %s
                    LIMIT 1
                """, (campaign_id, target_user_id, list(exclusive_keys), "use", effective_on)).fetchone()
                if conflict_row:
                    raise HTTPException(status_code=400, detail="Target already has a conflicting effect for that day")

        use_count_before = 0
        if not is_admin_flag and ITEM_MASTER_THRESHOLD:
            use_count_before = conn.execute("""
                SELECT COUNT(*)
                FROM campaign_item_events
                WHERE user_id = %s AND campaign_id = %s AND event_type = 'use'
            """, (user_id, campaign_id)).fetchone()[0]

        conn.execute("""
            UPDATE campaign_user_items
            SET quantity = quantity - 1
            WHERE user_id = %s AND campaign_id = %s AND item_key = %s
        """, (user_id, campaign_id, item_key))

        handler = item.get("handler")
        if handler:
            effect_payload = handler(conn, user_id, campaign_id)
            if effect_payload:
                details_payload.update(effect_payload)
                if "hint" in effect_payload:
                    hint_payload = effect_payload["hint"]

        details = json.dumps(details_payload)
        conn.execute("""
            INSERT INTO campaign_item_events (user_id, campaign_id, item_key, target_user_id, event_type, details)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (user_id, campaign_id, item_key, target_user_id, "use", details))

        if not is_admin_flag:
            conn.execute("""
                INSERT INTO global_item_stats (item_key, uses, targets, last_used_at)
                VALUES (%s, 1, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (item_key)
                DO UPDATE SET uses = global_item_stats.uses + 1,
                              targets = global_item_stats.targets + %s,
                              last_used_at = CURRENT_TIMESTAMP
            """, (item_key, 1 if target_user_id else 0, 1 if target_user_id else 0))

        if not is_admin_flag and ITEM_MASTER_THRESHOLD:
            if use_count_before < ITEM_MASTER_THRESHOLD <= use_count_before + 1:
                today_str = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")
                award_accolade(conn, campaign_id, user_id, "item_master", today_str)

        remaining_row = conn.execute("""
            SELECT quantity
            FROM campaign_user_items
            WHERE user_id = %s AND campaign_id = %s AND item_key = %s
        """, (user_id, campaign_id, item_key)).fetchone()
        remaining = remaining_row[0] if remaining_row else 0

    return {"item_key": item_key, "remaining": remaining, "hint": hint_payload}

def get_current_day_hint(user_id: int, campaign_id: int):
    with get_db() as conn:
        _, _, _, target_day, _ = resolve_campaign_day(conn, campaign_id, None)
        row = conn.execute("""
            SELECT effect_value, expires_at, active
            FROM campaign_user_status_effects
            WHERE user_id = %s AND campaign_id = %s AND effect_key = %s
        """, (user_id, campaign_id, "oracle_whisper")).fetchone()
        if not row or not row[0]:
            return {"hint": None}

        expires_at = row[1]
        active = row[2] if row[2] is not None else True
        if not active:
            return {"hint": None}
        if expires_at:
            now_ct = datetime.now(ZoneInfo("America/Chicago"))
            compare_now = now_ct if expires_at.tzinfo else now_ct.replace(tzinfo=None)
            if expires_at < compare_now:
                return {"hint": None}

        try:
            payload = json.loads(row[0])
        except json.JSONDecodeError:
            return {"hint": None}

        if payload.get("day") != target_day:
            return {"hint": None}

        return {"hint": payload}
