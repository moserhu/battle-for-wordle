import sqlite3
from datetime import datetime
import random
import string
from zoneinfo import ZoneInfo  
from hashlib import sha256
from collections import Counter
import os
from fastapi import HTTPException

DB = "game.db"

def get_db():
    return sqlite3.connect(DB)


def register_user(first_name, last_name, email, phone, password):
    with get_db() as conn:
        try:
            conn.execute("""
                INSERT INTO users (first_name, last_name, email, phone, password)
                VALUES (?, ?, ?, ?, ?)
            """, (first_name, last_name, email.lower(), phone, password))
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
            "SELECT id, first_name FROM users WHERE email = ? AND password = ?",
            (email.lower(), password)
        ).fetchone()

        if user:
            return {"user_id": user[0], "first_name": user[1]}
        
        raise HTTPException(status_code=401, detail="Invalid credentials")

def create_campaign(name, user_id):
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    today = datetime.now().strftime("%Y-%m-%d")
    with get_db() as conn:
        conn.execute("INSERT INTO campaigns (name, owner_id, invite_code, start_date) VALUES (?, ?, ?, ?)",
                     (name, user_id, code, today))
        camp_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.execute("INSERT INTO campaign_members (user_id, campaign_id) VALUES (?, ?)", (user_id, camp_id))
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

        conn.execute(
            "INSERT INTO campaign_members (user_id, campaign_id) VALUES (?, ?)",
            (user_id, campaign_id)
        )
        return {"message": "Joined campaign", "campaign_id": campaign_id}



def get_user_campaigns(user_id: int):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT c.id, c.name,
                   EXISTS (
                       SELECT 1 FROM guesses g
                       WHERE g.user_id = ? AND g.campaign_id = c.id
                             AND g.date = DATE('now', 'localtime')
                   ) as has_played
            FROM campaigns c
            JOIN campaign_members cm ON cm.campaign_id = c.id
            WHERE cm.user_id = ?
        """, (user_id, user_id)).fetchall()

    return [
        {
            "campaign_id": row[0],
            "name": row[1],
            "has_played": bool(row[2])
        }
        for row in rows
    ]



def load_valid_words():
    base_dir = os.path.dirname(__file__)
    wordlist_path = os.path.join(base_dir, "data", "wordlist.txt")
    with open(wordlist_path, "r") as f:
        return set(word.strip().lower() for word in f.readlines())

VALID_WORDS = load_valid_words()



#word list and the daily word function
WORDLIST = ["apple", "stone", "ghost", "liver", "brave", "quest", "flame", "crown", "witch", "armor"]

def get_daily_word(campaign_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT start_date FROM campaigns WHERE id = ?",
            (campaign_id,)
        ).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    start_date = datetime.strptime(row[0], "%Y-%m-%d").date()
    today = datetime.now(ZoneInfo("America/Chicago")).date()
    delta_days = (today - start_date).days

    index = delta_days % len(WORDLIST)
    return WORDLIST[index]



def validate_guess(word: str, user_id: int, campaign_id: int):
    if word.lower() not in VALID_WORDS:
        raise HTTPException(status_code=400, detail="Invalid word")

    secret = get_daily_word(campaign_id)
    guess = word.lower()
    result = ['absent'] * 5
    secret_counts = Counter(secret)

    # First pass: mark correct letters
    for i in range(5):
        if guess[i] == secret[i]:
            result[i] = 'correct'
            secret_counts[guess[i]] -= 1

    # Second pass: mark present letters
    for i in range(5):
        if result[i] == 'correct':
            continue
        if guess[i] in secret_counts and secret_counts[guess[i]] > 0:
            result[i] = 'present'
            secret_counts[guess[i]] -= 1

    correct = all(r == 'correct' for r in result)

    with get_db() as conn:
        #  Save a win if correct
        if correct:
            conn.execute(
                "UPDATE campaign_members SET score = score + 1 WHERE user_id = ? AND campaign_id = ?",
                (user_id, campaign_id)
            )

        #  Always insert the guess for "played today" tracking
        conn.execute("""
            INSERT INTO guesses (user_id, campaign_id, word, date)
            VALUES (?, ?, ?, DATE('now', 'localtime'))
        """, (user_id, campaign_id, guess))

    return {
        "result": result,
        "correct": correct,
        "word": secret
    }


def get_campaign_day(campaign_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT start_date FROM campaigns WHERE id = ?",
            (campaign_id,)
        ).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    start_date = datetime.strptime(row[0], "%Y-%m-%d").date()
    today = datetime.now(ZoneInfo("America/Chicago")).date()
    delta = (today - start_date).days

    return {"day": delta + 1, "total": 5}  

def get_campaign_progress(campaign_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT name, start_date FROM campaigns WHERE id = ?",
            (campaign_id,)
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    name, start_date_str = row
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    today = datetime.now(ZoneInfo("America/Chicago")).date()
    delta = (today - start_date).days

    return {
        "name": name,
        "day": min(delta + 1, 5),
        "total": 5
    }


def get_leaderboard(campaign_id: int):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT u.first_name, cm.score
            FROM campaign_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.campaign_id = ?
            ORDER BY cm.score DESC
            """,
            (campaign_id,)
        ).fetchall()

    return [{"username": row[0], "score": row[1]} for row in rows]



