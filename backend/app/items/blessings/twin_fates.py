import json
from datetime import timedelta
from app.utils.campaigns import resolve_campaign_day


def _twin_fates(conn, user_id: int, campaign_id: int):
    _, _, _, target_day, target_date = resolve_campaign_day(conn, campaign_id, None)
    word_row = conn.execute(
        "SELECT word FROM campaign_words WHERE campaign_id = %s AND day = %s",
        (campaign_id, target_day)
    ).fetchone()
    if not word_row:
        return {"twins": {"day": target_day, "letters": []}}

    word = str(word_row[0] or "").upper()
    pos_by_letter = {}
    for idx, letter in enumerate(word):
        pos_by_letter.setdefault(letter, []).append(idx + 1)
    twins = [{"letter": k, "positions": v} for k, v in pos_by_letter.items() if len(v) >= 2]

    payload = {"day": target_day, "letters": twins}
    expires_at = target_date + timedelta(days=1)
    conn.execute("""
        INSERT INTO campaign_user_status_effects (user_id, campaign_id, effect_key, effect_value, applied_at, expires_at, active)
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, %s, TRUE)
        ON CONFLICT (user_id, campaign_id, effect_key)
        DO UPDATE SET effect_value = EXCLUDED.effect_value,
                      applied_at = EXCLUDED.applied_at,
                      expires_at = EXCLUDED.expires_at,
                      active = TRUE
    """, (user_id, campaign_id, "twin_fates", json.dumps(payload), expires_at))
    return {"twins": payload}


twin_fates_item = {
    "key": "twin_fates",
    "name": "Twin Fates",
    "description": "If a word has double letters, the positions are revealed.",
    "cost": 8,
    "category": "blessing",
    "handler": _twin_fates
}
