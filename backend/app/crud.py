import sqlite3
from datetime import datetime
import random
import string
from zoneinfo import ZoneInfo  
from hashlib import sha256
from collections import Counter

DB = "game.db"

def get_db():
    return sqlite3.connect(DB)

def register_user(username, password):
    with get_db() as conn:
        try:
            conn.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
            return {"status": "ok"}
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Username already exists")

def login_user(username, password):
    with get_db() as conn:
        user = conn.execute("SELECT id FROM users WHERE username = ? AND password = ?", (username, password)).fetchone()
        if user:
            return {"user_id": user[0]}
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

    # Track score and return as before
    correct = all(r == 'correct' for r in result)
    if correct:
        with get_db() as conn:
            conn.execute(
                "UPDATE campaign_members SET score = score + 1 WHERE user_id = ? AND campaign_id = ?",
                (user_id, campaign_id)
            )

    return {
        "result": result,
        "correct": correct,
        "word": secret
    }


def get_leaderboard(campaign_id: int):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT u.username, cm.score
            FROM campaign_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.campaign_id = ?
            ORDER BY cm.score DESC
            """,
            (campaign_id,)
        ).fetchall()

    return [{"username": row[0], "score": row[1]} for row in rows]


