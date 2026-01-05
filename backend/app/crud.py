import psycopg
from psycopg.rows import tuple_row
from datetime import datetime
import random
import string
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

DB_URL = os.getenv("DATABASE_URL")

def get_db():
    if not DB_URL:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(DB_URL, row_factory=tuple_row)



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
            "SELECT id, first_name, password FROM users WHERE email = %s",
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
                return {"user_id": user[0], "first_name": user[1]}

        raise HTTPException(status_code=401, detail="Invalid credentials")



def create_campaign(name, user_id, cycle_length):
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")

    with get_db() as conn:
        cur = conn.execute("""
            INSERT INTO campaigns (name, owner_id, invite_code, start_date, cycle_length)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (name, user_id, code, today, cycle_length))

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

        conn.execute("UPDATE users SET campaigns = campaigns + 1 WHERE id = %s", (user_id,))

        initialize_campaign_words(camp_id, cycle_length, conn)

    return {"campaign_id": camp_id, "invite_code": code}

def join_campaign(invite_code, user_id):
    with get_db() as conn:
        campaign = conn.execute(
            "SELECT id FROM campaigns WHERE invite_code = %s",
            (invite_code,)
        ).fetchone()

        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")

        campaign_id = campaign[0]

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

        conn.execute("UPDATE users SET campaigns = campaigns + 1 WHERE id = %s", (user_id,))

        return {"message": "Joined campaign", "campaign_id": campaign_id}


def join_campaign_by_id(campaign_id, user_id):
    with get_db() as conn:
        # 🔒 Check for campaign expiration
        row = conn.execute("""
            SELECT start_date, cycle_length
            FROM campaigns
            WHERE id = %s
        """, (campaign_id,)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Campaign not found")

        start_date_str, cycle_length = row
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
        campaign_id, name, start_date_str, cycle_length, is_finished, dd_activated, daily_completed = row

        # Safely calculate current day
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        day = min((today - start_date).days + 1, cycle_length)

        campaign_list.append({
            "campaign_id": campaign_id,
            "name": name,
            "day": day,
            "total": cycle_length,
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
                   campaign_wins, campaign_losses, clicked_update
            FROM users WHERE id = %s
        """, (user_id,)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="User not found")

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
            "clicked_update": row[9]
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

def load_playable_words():
    base_dir = os.path.dirname(__file__)
    wordlist_path = os.path.join(base_dir, "data", "playablewordlist.txt")
    with open(wordlist_path, "r") as f:
        return [line.strip().lower() for line in f if line.strip()]

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

def update_campaign_streak(conn, user_id: int, campaign_id: int, date_str: str):
    row = conn.execute("""
        SELECT streak, last_completed_date
        FROM campaign_streaks
        WHERE user_id = %s AND campaign_id = %s
    """, (user_id, campaign_id)).fetchone()

    if row:
        streak, last_completed_date = row
        if last_completed_date == date_str:
            return
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
        conn.execute("""
            UPDATE campaign_streaks
            SET streak = %s, last_completed_date = %s
            WHERE user_id = %s AND campaign_id = %s
        """, (new_streak, date_str, user_id, campaign_id))
    else:
        conn.execute("""
            INSERT INTO campaign_streaks (user_id, campaign_id, streak, last_completed_date)
            VALUES (%s, %s, %s, %s)
        """, (user_id, campaign_id, 1, date_str))
        new_streak = 1
        recovery_days = None

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

def update_campaign_coins(conn, user_id: int, campaign_id: int, date_str: str, coins_to_add: int):
    row = conn.execute("""
        SELECT coins, last_awarded_date
        FROM campaign_coins
        WHERE user_id = %s AND campaign_id = %s
    """, (user_id, campaign_id)).fetchone()

    if row:
        _, last_awarded_date = row
        if last_awarded_date == date_str:
            return
        conn.execute("""
            UPDATE campaign_coins
            SET coins = coins + %s, last_awarded_date = %s
            WHERE user_id = %s AND campaign_id = %s
        """, (coins_to_add, date_str, user_id, campaign_id))
    else:
        conn.execute("""
            INSERT INTO campaign_coins (user_id, campaign_id, coins, last_awarded_date)
            VALUES (%s, %s, %s, %s)
        """, (user_id, campaign_id, coins_to_add, date_str))


def get_daily_word(campaign_id: int):
    today = datetime.now(ZoneInfo("America/Chicago")).date()

    with get_db() as conn:
        row = conn.execute(
            "SELECT start_date FROM campaigns WHERE id = %s",
            (campaign_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Campaign not found")

        start_date = datetime.strptime(row[0], "%Y-%m-%d").date()
        delta_days = (today - start_date).days
        day = delta_days + 1  # Day 1-based

        word_row = conn.execute(
            "SELECT word FROM campaign_words WHERE campaign_id = %s AND day = %s",
            (campaign_id, day)
        ).fetchone()

    if not word_row:
        raise HTTPException(status_code=404, detail="No word assigned for today")

    return word_row[0]

def validate_guess(word: str, user_id: int, campaign_id: int):
    points_by_row = {
        0: 150,
        1: 100,
        2: 60,
        3: 40,
        4: 30,
        5: 10
    }
    coins_by_row = {
        0: 6,
        1: 5,
        2: 4,
        3: 3,
        4: 2,
        5: 1
    }

    if word.lower() not in VALID_WORDS:
        raise HTTPException(status_code=204, detail="Invalid word")

    secret = get_daily_word(campaign_id)
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
    today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")

    with get_db() as conn:
        conn.execute("BEGIN")

        # NEW: if this exact word was already guessed today, bail out without mutating state
        dup = conn.execute("""
            SELECT 1
            FROM campaign_guesses
            WHERE user_id = %s AND campaign_id = %s AND date = %s AND word = %s
        """, (user_id, campaign_id, today, guess)).fetchone()
        if dup:
            return {
                "result": result,      
                "correct": correct,
                "word": secret,
                "duplicate": True
            }
        
        # Check if it's past 8 PM on final day
        campaign_row = conn.execute("SELECT start_date, cycle_length FROM campaigns WHERE id = %s", (campaign_id,)).fetchone()
        if not campaign_row:
            raise HTTPException(status_code=404, detail="Campaign not found")

        start_date = datetime.strptime(campaign_row[0], "%Y-%m-%d").date()
        cycle_length = campaign_row[1]
        today_date = datetime.now(ZoneInfo("America/Chicago")).date()
        delta_days = (today_date - start_date).days
        is_final_day = (delta_days + 1) == cycle_length
        now_ct = datetime.now(ZoneInfo("America/Chicago"))
        cutoff_time = now_ct.replace(hour=20, minute=0, second=0, microsecond=0)

        if is_final_day and now_ct >= cutoff_time:
            raise HTTPException(status_code=403, detail="Campaign ended for the day. No more guesses allowed after 8 PM.")

        # Fetch progress
        row = conn.execute("""
            SELECT guesses, results, letter_status, current_row, game_over
            FROM campaign_guess_states
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, today)).fetchone()

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

        if current_row == 0:
            conn.execute("""
                INSERT INTO campaign_first_guesses (user_id, campaign_id, date, word)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, campaign_id, date) DO NOTHING
            """, (user_id, campaign_id, today, guess))

        if game_over or current_row >= 6:
            raise HTTPException(status_code=403, detail="You've already played today")

        guesses[current_row] = list(guess)

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
        is_double_down = dd_row and dd_row[0] == 1
        max_rows = 3 if is_double_down else 6
        new_game_over = correct or current_row + 1 == max_rows

        if correct:
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
                    """, (score_to_add, today, user_id, campaign_id))
                else:
                    conn.execute("""
                        UPDATE campaign_members
                        SET double_down_activated = 0,
                            double_down_used_week = 1,
                            double_down_date = %s
                        WHERE user_id = %s AND campaign_id = %s
                    """, (today, user_id, campaign_id))
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
            """, (user_id, campaign_id, today, score_to_add))

        elif new_game_over and is_double_down:
            conn.execute("""
                UPDATE campaign_members
                SET double_down_activated = 0,
                    double_down_used_week = 1,
                    double_down_date = %s
                WHERE user_id = %s AND campaign_id = %s
            """, (today, user_id, campaign_id))

        # Save to guesses table
        conn.execute("""
            INSERT INTO campaign_guesses (user_id, campaign_id, word, date)
            VALUES (%s, %s, %s, %s)
        """, (user_id, campaign_id, guess, today))


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
            user_id, campaign_id, today,
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
            today,
            int(new_game_over)
        ))

        if new_game_over:
            update_campaign_streak(conn, user_id, campaign_id, today)
            if correct:
                coins_to_add = coins_by_row.get(current_row, 1)
            else:
                coins_to_add = 2
            update_campaign_coins(conn, user_id, campaign_id, today, coins_to_add)

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
            """, (user_id, campaign_id, today)).fetchone()
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
                today,
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
                today,
                today
            ))

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
                    total_days_played + 1,
                    dd_used + dd_used_add,
                    dd_success + dd_success_add,
                    dd_bonus + dd_bonus_add,
                    coins_total + coins_to_add,
                    user_id,
                    campaign_id
                ))
            else:
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

        return {
            "result": result,
            "correct": correct,
            "word": secret
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
            "SELECT name, start_date, invite_code, cycle_length, king FROM campaigns WHERE id = %s",
            (campaign_id,)
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    name, start_date_str, invite_code, cycle_length, king = row
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    today = datetime.now(ZoneInfo("America/Chicago")).date()
    delta = (today - start_date).days

    return {
        "name": name,
        "day": min(delta + 1, cycle_length),
        "total": cycle_length,
        "invite_code": invite_code,
        "king": king
    }

def get_campaign_streak(user_id: int, campaign_id: int):
    with get_db() as conn:
        row = conn.execute("""
            SELECT streak
            FROM campaign_streaks
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

def get_leaderboard(campaign_id: int):
    today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")

    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT 
                cm.display_name,
                cm.color,
                cm.score,
                COALESCE(dp.completed, 0) as played_today
            FROM campaign_members cm
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
            "username": row[0],
            "color": row[1],
            "score": row[2],
            "played_today": bool(row[3])
        }
        for row in rows
    ]

def get_saved_progress(user_id: int, campaign_id: int):
    today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")

    with get_db() as conn:
        # Check if Double Down was activated on a previous day but not completed
        row = conn.execute("""
            SELECT double_down_activated, double_down_date
            FROM campaign_members
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()

        if row and row[0] == 1 and row[1] and row[1] < today:
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
                """, (today, user_id, campaign_id))

        # Fetch today's saved progress
        row = conn.execute("""
            SELECT guesses, results, letter_status, current_row, game_over
            FROM campaign_guess_states
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, today)).fetchone()

    if row:
        return {
            "guesses": json.loads(row[0]),
            "results": json.loads(row[1]),
            "letter_status": json.loads(row[2]),
            "current_row": row[3],
            "game_over": bool(row[4])
        }

    # 🧼 Default fallback for new day/campaign
    return {
        "guesses": [["", "", "", "", ""] for _ in range(6)],
        "results": [None for _ in range(6)],
        "letter_status": {},
        "current_row": 0,
        "game_over": 0
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
                c.cycle_length
            FROM campaign_members cm
            JOIN users u ON u.id = cm.user_id
            JOIN campaigns c ON c.id = cm.campaign_id
            WHERE cm.campaign_id = %s
            ORDER BY cm.score DESC
        """, (campaign_id,)).fetchall()

        if standings:
            user_id, score, display_name, first_name, last_name, camp_name, start_date_str, cycle_length = standings[0]

            # Determine when this “season” ended
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            final_day = start_date + timedelta(days=cycle_length - 1)
            today = datetime.now(ZoneInfo("America/Chicago")).date()

            # If campaign is ended early via API, use today; otherwise use natural final day.
            ended_on = min(today, final_day)

            # Persist reigning king for the next cycle.
            conn.execute("""
                UPDATE campaigns
                SET king = %s
                WHERE id = %s
            """, (first_name, campaign_id))

            # 1a. Record global high score entries for all members
            for member_user_id, member_score, member_display_name, member_first, member_last, *_ in standings:
                if not member_score or member_score <= 0:
                    continue
                player_name = (member_display_name or f"{member_first} {member_last}").strip()
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
        conn.execute("UPDATE campaigns SET start_date = %s WHERE id = %s", (today_str, campaign_id))

        # 3. Clear old campaign data
        conn.execute("DELETE FROM campaign_guesses WHERE campaign_id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_guess_states WHERE campaign_id = %s", (campaign_id,))
        conn.execute("DELETE FROM campaign_daily_progress WHERE campaign_id = %s", (campaign_id,))
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
            SELECT u.first_name
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
            SET king = %s
            WHERE id = %s
        """, (row[0], campaign_id))

    return {"status": "ruler updated"}


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
                   COALESCE(dp.completed, 0) as daily_completed
            FROM campaign_members cm
            LEFT JOIN campaign_daily_progress dp
              ON dp.user_id = cm.user_id
             AND dp.campaign_id = cm.campaign_id
             AND dp.date = %s
            WHERE cm.campaign_id = %s AND cm.user_id = %s
        """, (today, campaign_id, user_id)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Membership not found")

        return {
            "display_name": row[0],
            "color": row[1],
            "double_down_activated": row[2],
            "double_down_used_week": row[3],
            "double_down_date": row[4],
            "daily_completed": row[5]
        }

def update_campaign_member(campaign_id: int, user_id: int, display_name: str, color: str):
    with get_db() as conn:
        result = conn.execute("""
            UPDATE campaign_members
            SET display_name = %s, color = %s
            WHERE user_id = %s AND campaign_id = %s
        """, (display_name, color, user_id, campaign_id))

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Campaign membership not found")

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
