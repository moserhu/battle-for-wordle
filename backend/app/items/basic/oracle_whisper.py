from datetime import datetime, timedelta
import json
import random
from fastapi import HTTPException
from app.utils.campaigns import resolve_campaign_day

def _oracle_whisper(conn, user_id: int, campaign_id: int):
    _, _, _, target_day, target_date = resolve_campaign_day(conn, campaign_id, None)
    target_date_str = target_date.strftime("%Y-%m-%d")

    dd_row = conn.execute("""
        SELECT double_down_activated
        FROM campaign_members
        WHERE user_id = %s AND campaign_id = %s
    """, (user_id, campaign_id)).fetchone()
    if dd_row and dd_row[0] == 1:
        raise HTTPException(status_code=400, detail="Oracle's Whisper cannot be used during Double Down.")

    used_row = conn.execute("""
        SELECT 1
        FROM campaign_item_events
        WHERE user_id = %s
          AND campaign_id = %s
          AND item_key = %s
          AND event_type = %s
          AND DATE(created_at) = %s
    """, (user_id, campaign_id, "oracle_whisper", "use", target_date_str)).fetchone()
    if used_row:
        raise HTTPException(status_code=400, detail="Oracle's Whisper can only be used once per day.")
    word_row = conn.execute(
        "SELECT word FROM campaign_words WHERE campaign_id = %s AND day = %s",
        (campaign_id, target_day)
    ).fetchone()
    if not word_row:
        raise HTTPException(status_code=404, detail="No word assigned for that day")

    word = word_row[0]
    target_date_str = target_date.strftime("%Y-%m-%d")
    confirmed_letters = set()
    status_row = conn.execute("""
        SELECT letter_status
        FROM campaign_guess_states
        WHERE user_id = %s AND campaign_id = %s AND date = %s
    """, (user_id, campaign_id, target_date_str)).fetchone()
    if status_row and status_row[0]:
        try:
            status = json.loads(status_row[0])
            confirmed_letters = {k.upper() for k, v in status.items() if v == "correct"}
        except json.JSONDecodeError:
            confirmed_letters = set()

    positions = list(range(len(word)))
    random.shuffle(positions)
    chosen = None
    for pos in positions:
        if word[pos].upper() not in confirmed_letters:
            chosen = pos
            break
    if chosen is None:
        chosen = random.randint(0, len(word) - 1)

    position = chosen
    letter = word[position].upper()
    hint_payload = {"day": target_day, "position": position + 1, "letter": letter}

    expires_at = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
    conn.execute("""
        INSERT INTO campaign_user_status_effects (user_id, campaign_id, effect_key, effect_value, applied_at, expires_at, active)
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, %s, TRUE)
        ON CONFLICT (user_id, campaign_id, effect_key)
        DO UPDATE SET effect_value = EXCLUDED.effect_value,
                      applied_at = EXCLUDED.applied_at,
                      expires_at = EXCLUDED.expires_at,
                      active = TRUE
    """, (user_id, campaign_id, "oracle_whisper", json.dumps(hint_payload), expires_at))

    return {"hint": hint_payload}

oracle_whisper_item = {
    "key": "oracle_whisper",
    "name": "Oracle's Whisper",
    "description": "A whisper of truth slips through, hinting at a single place it belongs.",
    "cost": 5,
    "category": "basic",
    "handler": _oracle_whisper
}
