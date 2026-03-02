def _earthquake(conn, user_id: int, campaign_id: int):
    return {}

earthquake_item = {
    "key": "earthquake",
    "name": "Earthquake",
    "description": "Shake and jostle the board tiles.",
    "cost": 2,
    "category": "illusion",
    "handler": _earthquake,
    "affects_others": True,
    "requires_target": True
}
