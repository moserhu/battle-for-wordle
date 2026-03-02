import json
from datetime import timedelta
from app.utils.campaigns import resolve_campaign_day


def _god_of_the_easy_tongue(conn, user_id: int, campaign_id: int):
    _, _, _, target_day, target_date = resolve_campaign_day(conn, campaign_id, None)
    word_row = conn.execute(
        "SELECT word FROM campaign_words WHERE campaign_id = %s AND day = %s",
        (campaign_id, target_day)
    ).fetchone()
    vowel_count = 0
    if word_row and word_row[0]:
        word = str(word_row[0]).upper()
        vowel_count = sum(1 for ch in word if ch in {"A", "E", "I", "O", "U"})

    payload = {"day": target_day, "vowel_count": vowel_count}
    expires_at = target_date + timedelta(days=1)
    conn.execute("""
        INSERT INTO campaign_user_status_effects (user_id, campaign_id, effect_key, effect_value, applied_at, expires_at, active)
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, %s, TRUE)
        ON CONFLICT (user_id, campaign_id, effect_key)
        DO UPDATE SET effect_value = EXCLUDED.effect_value,
                      applied_at = EXCLUDED.applied_at,
                      expires_at = EXCLUDED.expires_at,
                      active = TRUE
    """, (user_id, campaign_id, "god_of_the_easy_tongue", json.dumps(payload), expires_at))
    return {"easy_tongue": payload}


god_of_the_easy_tongue_item = {
    "key": "god_of_the_easy_tongue",
    "name": "God of the Easy Tongue",
    "description": "Reveal the total vowel count in today's word.",
    "cost": 4,
    "category": "blessing",
    "handler": _god_of_the_easy_tongue
}
