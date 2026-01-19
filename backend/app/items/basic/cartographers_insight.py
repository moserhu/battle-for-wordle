import json
import random
from datetime import timedelta
from fastapi import HTTPException
from app.utils.campaigns import resolve_campaign_day

def _cartographers_insight(conn, user_id: int, campaign_id: int):
    _, _, _, target_day, target_date = resolve_campaign_day(conn, campaign_id, None)
    word_row = conn.execute(
        "SELECT word FROM campaign_words WHERE campaign_id = %s AND day = %s",
        (campaign_id, target_day)
    ).fetchone()
    if not word_row:
        raise HTTPException(status_code=404, detail="No word assigned for that day")

    word = word_row[0].upper()
    target_date_str = target_date.strftime("%Y-%m-%d")
    used_letters = set()
    progress_row = conn.execute("""
        SELECT guesses
        FROM campaign_guess_states
        WHERE user_id = %s AND campaign_id = %s AND date = %s
    """, (user_id, campaign_id, target_date_str)).fetchone()
    if progress_row and progress_row[0]:
        try:
            guesses = json.loads(progress_row[0])
            for row in guesses:
                for letter in row:
                    if letter:
                        used_letters.add(letter.upper())
        except json.JSONDecodeError:
            used_letters = set()

    alphabet = [chr(c) for c in range(ord("A"), ord("Z") + 1)]
    unused = [c for c in alphabet if c not in word and c not in used_letters]
    random.shuffle(unused)
    revealed = unused[:2] if len(unused) >= 2 else unused

    payload = {"day": target_day, "unused_letters": revealed}
    expires_at = target_date + timedelta(days=1)
    conn.execute("""
        INSERT INTO campaign_user_status_effects (user_id, campaign_id, effect_key, effect_value, applied_at, expires_at, active)
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, %s, TRUE)
        ON CONFLICT (user_id, campaign_id, effect_key)
        DO UPDATE SET effect_value = EXCLUDED.effect_value,
                      applied_at = EXCLUDED.applied_at,
                      expires_at = EXCLUDED.expires_at,
                      active = TRUE
    """, (user_id, campaign_id, "cartographers_insight", json.dumps(payload), expires_at))

    return {"cartography": payload}

cartographers_insight_item = {
    "key": "cartographers_insight",
    "name": "Cartographer's Insight",
    "description": "The map rejects a pair of paths; two letters are cast aside.",
    "cost": 5,
    "category": "basic",
    "handler": _cartographers_insight
}
