import json

def _candle_of_mercy(conn, user_id: int, campaign_id: int):
    payload = {"bonus_troops_on_fail": 10}
    conn.execute("""
        INSERT INTO campaign_user_status_effects (user_id, campaign_id, effect_key, effect_value, applied_at, active)
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, TRUE)
        ON CONFLICT (user_id, campaign_id, effect_key)
        DO UPDATE SET effect_value = EXCLUDED.effect_value,
                      applied_at = EXCLUDED.applied_at,
                      active = TRUE
    """, (user_id, campaign_id, "candle_of_mercy", json.dumps(payload)))

    return {"mercy": payload}

candle_of_mercy_item = {
    "key": "candle_of_mercy",
    "name": "Candle of Mercy",
    "description": "In loss, a small ember still answers your name.",
    "cost": 5,
    "category": "blessing",
    "handler": _candle_of_mercy
}
