import json
from app.utils.campaigns import resolve_campaign_day


def _dispel_curse(conn, user_id: int, campaign_id: int):
    _, _, _, target_day, _ = resolve_campaign_day(conn, campaign_id, None)
    payload = {"day": target_day, "dispelled": True}
    conn.execute("""
        INSERT INTO campaign_user_status_effects (
            user_id, campaign_id, effect_key, effect_value, applied_at, active
        )
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, FALSE)
        ON CONFLICT (user_id, campaign_id, effect_key)
        DO UPDATE SET effect_value = EXCLUDED.effect_value,
                      applied_at = EXCLUDED.applied_at,
                      active = FALSE
    """, (user_id, campaign_id, "cursed", json.dumps(payload)))
    return {"cleansed": True}


dispel_curse_item = {
    "key": "dispel_curse",
    "name": "Dispel Curse",
    "description": "Remove your active Cursed status.",
    "cost": 8,
    "category": "blessing",
    "handler": _dispel_curse
}
