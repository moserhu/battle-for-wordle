import sqlite3
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

DB = os.getenv("DB_PATH")

def get_db():
    conn = sqlite3.connect(DB, timeout=10.0) 
    conn.execute("PRAGMA foreign_keys = ON")  # 🔥 CRITICAL
    return conn



def register_user(first_name, last_name, email, phone, password):
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    with get_db() as conn:
        try:
            conn.execute("""
                INSERT INTO users (first_name, last_name, email, phone, password)
                VALUES (?, ?, ?, ?, ?)
            """, (first_name, last_name, email.lower(), phone, hashed_pw))
            return {"status": "ok"}
        except sqlite3.IntegrityError as e:
            if "email" in str(e).lower():
                raise HTTPException(status_code=400, detail="Email already registered")
            elif "phone" in str(e).lower():
                raise HTTPException(status_code=400, detail="Phone number already registered")
            else:
                raise HTTPException(status_code=400, detail="Registration failed")



def login_user(email, password):
    with get_db() as conn:
        user = conn.execute(
            "SELECT id, first_name, password FROM users WHERE email = ?",
            (email.lower(),)
        ).fetchone()

        if user and bcrypt.checkpw(password.encode('utf-8'), user[2]):
            return {"user_id": user[0], "first_name": user[1]}

        raise HTTPException(status_code=401, detail="Invalid credentials")



def create_campaign(name, user_id, cycle_length):
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")

    with get_db() as conn:
        conn.execute("""
            INSERT INTO campaigns (name, owner_id, invite_code, start_date, cycle_length)
            VALUES (?, ?, ?, ?, ?)
        """, (name, user_id, code, today, cycle_length))

        camp_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        # Fetch the user's first name for default display name
        user_row = conn.execute("SELECT first_name FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        default_name = user_row[0]

        # Default color for campaign creator
        default_color = "#ffd700"

        conn.execute("""
            INSERT INTO campaign_members (user_id, campaign_id, display_name, color)
            VALUES (?, ?, ?, ?)
        """, (user_id, camp_id, default_name, default_color))

        conn.execute("UPDATE users SET campaigns = campaigns + 1 WHERE id = ?", (user_id,))

        initialize_campaign_words(camp_id, cycle_length, conn)

    return {"campaign_id": camp_id, "invite_code": code}





def join_campaign(invite_code, user_id):
    with get_db() as conn:
        campaign = conn.execute(
            "SELECT id FROM campaigns WHERE invite_code = ?",
            (invite_code,)
        ).fetchone()

        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")

        campaign_id = campaign[0]

        already_in = conn.execute(
            "SELECT 1 FROM campaign_members WHERE user_id = ? AND campaign_id = ?",
            (user_id, campaign_id)
        ).fetchone()

        if already_in:
            return {"message": "Already joined"}

        # Get user's first name
        user_row = conn.execute("SELECT first_name FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")

        default_name = user_row[0]

        # Get an unused color
        all_colors = ['#ffd700', '#c0c0c0', '#cd7f32', '#4caf50', '#2196f3',
                      '#9c27b0', '#ff5722', '#00bcd4', '#795548', '#607d8b']
        used_colors = conn.execute(
            "SELECT color FROM campaign_members WHERE campaign_id = ?", (campaign_id,)
        ).fetchall()
        used_colors = {row[0] for row in used_colors if row[0]}
        available_color = next((c for c in all_colors if c not in used_colors), '#000000')

        # Insert member with display name and color
        conn.execute("""
            INSERT INTO campaign_members (user_id, campaign_id, display_name, color)
            VALUES (?, ?, ?, ?)
        """, (user_id, campaign_id, default_name, available_color))

        conn.execute("UPDATE users SET campaigns = campaigns + 1 WHERE id = ?", (user_id,))

        return {"message": "Joined campaign", "campaign_id": campaign_id}



def join_campaign_by_id(campaign_id, user_id):
    with get_db() as conn:
        # Check if already a member
        already_in = conn.execute(
            "SELECT 1 FROM campaign_members WHERE user_id = ? AND campaign_id = ?",
            (user_id, campaign_id)
        ).fetchone()
        if already_in:
            return {"message": "Already joined"}

        # Fetch user's default name
        user_row = conn.execute("SELECT first_name FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")

        default_name = user_row[0]

        # Color assignment: use a rotating palette and skip used colors
        all_colors = ['#ffd700', '#c0c0c0', '#cd7f32', '#4caf50', '#2196f3',
                      '#9c27b0', '#ff5722', '#00bcd4', '#795548', '#607d8b']

        used_colors = conn.execute(
            "SELECT color FROM campaign_members WHERE campaign_id = ?", (campaign_id,)
        ).fetchall()
        used_colors = {row[0] for row in used_colors if row[0]}

        available_color = next((c for c in all_colors if c not in used_colors), '#000000')

        # Insert with defaults
        conn.execute("""
            INSERT INTO campaign_members (user_id, campaign_id, display_name, color)
            VALUES (?, ?, ?, ?)
        """, (user_id, campaign_id, default_name, available_color))

        conn.execute("UPDATE users SET campaigns = campaigns + 1 WHERE id = ?", (user_id,))
        return {"message": "Joined campaign", "campaign_id": campaign_id}

def get_user_campaigns(user_id: int):
    today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")
    with get_db() as conn:
        rows = conn.execute("""
            SELECT 
                c.id, 
                c.name,
                EXISTS (
                    SELECT 1 FROM campaign_daily_progress dp
                    WHERE dp.user_id = ? AND dp.campaign_id = c.id
                      AND dp.date = ?
                      AND dp.completed = 1
                ) as is_finished,
                cm.double_down_activated,
                COALESCE(dp.completed, 0) as daily_completed
            FROM campaigns c
            JOIN campaign_members cm ON cm.campaign_id = c.id
            LEFT JOIN campaign_daily_progress dp 
                ON dp.user_id = cm.user_id AND dp.campaign_id = cm.campaign_id AND dp.date = ?
            WHERE cm.user_id = ?
        """, (user_id, today, today, user_id)).fetchall()

    return [
        {
            "campaign_id": row[0],
            "name": row[1],
            "is_finished": bool(row[2]),  # legacy support
            "double_down_activated": row[3],
            "daily_completed": row[4],
        }
        for row in rows
    ]

def get_user_info(user_id: int):
    with get_db() as conn:
        row = conn.execute("""
            SELECT first_name, last_name, phone, email,
                   campaigns, total_guesses, correct_guesses,
                   campaign_wins, campaign_losses, clicked_update
            FROM users WHERE id = ?
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
                SET first_name = ?, last_name = ?, phone = ?
                WHERE id = ?
            """, (first_name, last_name, phone, user_id))
            return {"status": "ok"}
        except sqlite3.IntegrityError as e:
            if "phone" in str(e).lower():
                raise HTTPException(status_code=400, detail="Phone number already registered")
            raise HTTPException(status_code=400, detail="Failed to update user info")

def acknowledge_update(user_id: int):
    with get_db() as conn:
        conn.execute("""
            UPDATE users SET clicked_update = 1 WHERE id = ?
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
            "INSERT INTO campaign_words (campaign_id, day, word) VALUES (?, ?, ?)",
            (campaign_id, day, word)
        )


def get_daily_word(campaign_id: int):
    today = datetime.now(ZoneInfo("America/Chicago")).date()

    with get_db() as conn:
        row = conn.execute(
            "SELECT start_date FROM campaigns WHERE id = ?",
            (campaign_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Campaign not found")

        start_date = datetime.strptime(row[0], "%Y-%m-%d").date()
        delta_days = (today - start_date).days
        day = delta_days + 1  # Day 1-based

        word_row = conn.execute(
            "SELECT word FROM campaign_words WHERE campaign_id = ? AND day = ?",
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

    if word.lower() not in VALID_WORDS:
        raise HTTPException(status_code=400, detail="Invalid word")

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
        # Check if it's past 8 PM on final day
        start_row = conn.execute("SELECT start_date FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()
        if not start_row:
            raise HTTPException(status_code=404, detail="Campaign not found")

        start_date = datetime.strptime(start_row[0], "%Y-%m-%d").date()
        today_date = datetime.now(ZoneInfo("America/Chicago")).date()
        delta_days = (today_date - start_date).days
        is_final_day = (delta_days + 1) == 5
        now_ct = datetime.now(ZoneInfo("America/Chicago"))
        cutoff_time = now_ct.replace(hour=20, minute=0, second=0, microsecond=0)

        if is_final_day and now_ct >= cutoff_time:
            raise HTTPException(status_code=403, detail="Campaign ended for the day. No more guesses allowed after 8 PM.")

        # Fetch progress
        row = conn.execute("""
            SELECT guesses, results, letter_status, current_row, game_over
            FROM campaign_guess_states
            WHERE user_id = ? AND campaign_id = ? AND date = ?
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

        if game_over or current_row >= 6:
            raise HTTPException(status_code=403, detail="You've already played today")

        guesses[current_row] = list(guess)

        # Increment total guesses
        conn.execute("""
            UPDATE users
            SET total_guesses = total_guesses + 1
            WHERE id = ?
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
            WHERE user_id = ? AND campaign_id = ?
        """, (user_id, campaign_id)).fetchone()
        is_double_down = dd_row and dd_row[0] == 1
        max_rows = 3 if is_double_down else 6
        new_game_over = correct or current_row + 1 == max_rows

        if correct:
            conn.execute("""
                UPDATE users
                SET correct_guesses = correct_guesses + 1
                WHERE id = ?
            """, (user_id,))

            score_to_add = points_by_row.get(current_row, 0)

            if is_double_down:
                if current_row <= 2:
                    score_to_add *= 2
                    conn.execute("""
                        UPDATE campaign_members
                        SET score = score + ?,
                            double_down_activated = 0,
                            double_down_used_week = 1,
                            double_down_date = ?
                        WHERE user_id = ? AND campaign_id = ?
                    """, (score_to_add, today, user_id, campaign_id))
                else:
                    current_score = conn.execute("""
                        SELECT score FROM campaign_members
                        WHERE user_id = ? AND campaign_id = ?
                    """, (user_id, campaign_id)).fetchone()[0] or 0
                    penalty = current_score // 2
                    conn.execute("""
                        UPDATE campaign_members
                        SET score = MAX(score - ?, 0),
                            double_down_activated = 0,
                            double_down_used_week = 1,
                            double_down_date = ?
                        WHERE user_id = ? AND campaign_id = ?
                    """, (penalty, today, user_id, campaign_id))
            else:
                conn.execute("""
                    UPDATE campaign_members
                    SET score = score + ?
                    WHERE user_id = ? AND campaign_id = ?
                """, (score_to_add, user_id, campaign_id))

        elif new_game_over and is_double_down:
            current_score = conn.execute("""
                SELECT score FROM campaign_members
                WHERE user_id = ? AND campaign_id = ?
            """, (user_id, campaign_id)).fetchone()[0] or 0
            penalty = current_score // 2
            conn.execute("""
                UPDATE campaign_members
                SET score = MAX(score - ?, 0),
                    double_down_activated = 0,
                    double_down_used_week = 1,
                    double_down_date = ?
                WHERE user_id = ? AND campaign_id = ?
            """, (penalty, today, user_id, campaign_id))

        # Save to guesses table
        conn.execute("""
            INSERT INTO campaign_guesses (user_id, campaign_id, word, date)
            VALUES (?, ?, ?, ?)
        """, (user_id, campaign_id, guess, today))

        # Save full state
        conn.execute("""
            INSERT OR REPLACE INTO campaign_guess_states (
                user_id, campaign_id, date,
                guesses, results, letter_status, current_row, game_over
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, campaign_id, today,
            json.dumps(guesses),
            json.dumps(results_data),
            json.dumps(letter_status),
            current_row + 1,
            int(new_game_over)
        ))

        conn.execute("""
            INSERT OR REPLACE INTO campaign_daily_progress (
                user_id, campaign_id, date, completed
            ) VALUES (?, ?, ?, ?)
        """, (
            user_id,
            campaign_id,
            today,
            int(new_game_over)
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
            WHERE user_id = ? AND campaign_id = ?
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
                double_down_date = ?
            WHERE user_id = ? AND campaign_id = ?
        """, (today, user_id, campaign_id))

    return {"status": "double down activated"}

def get_campaign_day(campaign_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT start_date, cycle_length FROM campaigns WHERE id = ?",
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
            "SELECT name, start_date, invite_code, cycle_length FROM campaigns WHERE id = ?",
            (campaign_id,)
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    name, start_date_str, invite_code, cycle_length = row
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    today = datetime.now(ZoneInfo("America/Chicago")).date()
    delta = (today - start_date).days

    return {
        "name": name,
        "day": min(delta + 1, cycle_length),
        "total": cycle_length,
        "invite_code": invite_code
    }

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
              AND dp.date = ?
            WHERE cm.campaign_id = ?
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
        row = conn.execute("""
            SELECT guesses, results, letter_status, current_row, game_over
            FROM campaign_guess_states
            WHERE user_id = ? AND campaign_id = ? AND date = ?
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
        # 1. Get winner by highest score
        winner = conn.execute("""
            SELECT user_id FROM campaign_members
            WHERE campaign_id = ?
            ORDER BY score DESC
            LIMIT 1
        """, (campaign_id,)).fetchone()

        if winner:
            conn.execute("""
                UPDATE users
                SET campaign_wins = campaign_wins + 1
                WHERE id = ?
            """, (winner[0],))

        # 2. Reset campaign to start over
        today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")
        conn.execute("UPDATE campaigns SET start_date = ? WHERE id = ?", (today, campaign_id))

        # 3. Clear old campaign data
        conn.execute("DELETE FROM campaign_guesses WHERE campaign_id = ?", (campaign_id,))
        conn.execute("DELETE FROM campaign_guess_states WHERE campaign_id = ?", (campaign_id,))
        conn.execute("DELETE FROM campaign_daily_progress WHERE campaign_id = ?", (campaign_id,))
        conn.execute("UPDATE campaign_members SET score = 0 WHERE campaign_id = ?", (campaign_id,))
        conn.execute("""
            UPDATE campaign_members
            SET double_down_used_week = 0,
                double_down_date = NULL
            WHERE double_down_date IS NOT NULL
              AND date(double_down_date) <= date(?, '-7 days')
        """, (today,))
        conn.execute("DELETE FROM campaign_words WHERE campaign_id = ?", (campaign_id,))
        
        # Reinitialize for a new cycle of # days 
        cycle_length = conn.execute("SELECT cycle_length FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()[0]
        initialize_campaign_words(campaign_id, cycle_length, conn)
        return {"status": "campaign reset", "new_start_date": today}


def has_campaign_finished_for_day(campaign_id: int):
    with get_db() as conn:
        # Total members
        total_members = conn.execute("""
            SELECT COUNT(*) FROM campaign_members WHERE campaign_id = ?
        """, (campaign_id,)).fetchone()[0]

        # Total who completed today
        today = datetime.now(ZoneInfo("America/Chicago")).strftime("%Y-%m-%d")
        finished_today = conn.execute("""
            SELECT COUNT(*) FROM campaign_daily_progress
            WHERE campaign_id = ? AND date = ? AND completed = 1
        """, (campaign_id, today)).fetchone()[0]

        return finished_today >= total_members

def delete_campaign(campaign_id: int, requester_id: int):
    with get_db() as conn:
        owner_check = conn.execute("SELECT owner_id FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()
        if not owner_check or owner_check[0] != requester_id:
            raise HTTPException(status_code=403, detail="Only the campaign owner can delete this campaign")

        conn.execute("DELETE FROM campaigns WHERE id = ?", (campaign_id,))
        conn.execute("DELETE FROM campaign_members WHERE campaign_id = ?", (campaign_id,))
        conn.execute("DELETE FROM campaign_guesses WHERE campaign_id = ?", (campaign_id,))
        conn.execute("DELETE FROM campaign_guess_states WHERE campaign_id = ?", (campaign_id,))
        conn.execute("DELETE FROM campaign_daily_progress WHERE campaign_id = ?", (campaign_id,))
        conn.execute("DELETE FROM campaign_words WHERE campaign_id = ?", (campaign_id,)) 
        return {"status": "deleted"}


def kick_player_from_campaign(campaign_id: int, target_user_id: int, requester_id: int):
    with get_db() as conn:
        owner_check = conn.execute("SELECT owner_id FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()
        if not owner_check or owner_check[0] != requester_id:
            raise HTTPException(status_code=403, detail="Only the campaign owner can kick players")

        conn.execute("DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ?", (campaign_id, target_user_id))
        return {"status": "kicked"}

def get_campaigns_by_owner(owner_id: int):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT id, name FROM campaigns WHERE owner_id = ?
        """, (owner_id,)).fetchall()

    return [{"id": row[0], "name": row[1]} for row in rows]

def get_campaign_members(campaign_id: int, requester_id: int):
    with get_db() as conn:
        owner = conn.execute(
            "SELECT owner_id FROM campaigns WHERE id = ?", 
            (campaign_id,)
        ).fetchone()

        if not owner or owner[0] != requester_id:
            raise HTTPException(status_code=403, detail="You are not the owner of this campaign")

        rows = conn.execute("""
            SELECT u.id, u.first_name || ' ' || u.last_name
            FROM campaign_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.campaign_id = ? AND u.id != ?
        """, (campaign_id, requester_id)).fetchall()

        return [{"user_id": r[0], "name": r[1]} for r in rows]

def get_self_member(campaign_id: int, user_id: int):
    with get_db() as conn:
        row = conn.execute("""
            SELECT display_name, color, double_down_activated, double_down_used_week
            FROM campaign_members
            WHERE campaign_id = ? AND user_id = ?
        """, (campaign_id, user_id)).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Membership not found")

        return {
            "display_name": row[0],
            "color": row[1],
            "double_down_activated": row[2],
            "double_down_used_week": row[3]
        }

def update_campaign_member(campaign_id: int, user_id: int, display_name: str, color: str):
    with get_db() as conn:
        result = conn.execute("""
            UPDATE campaign_members
            SET display_name = ?, color = ?
            WHERE user_id = ? AND campaign_id = ?
        """, (display_name, color, user_id, campaign_id))

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Campaign membership not found")

        return {"status": "updated", "display_name": display_name, "color": color}
