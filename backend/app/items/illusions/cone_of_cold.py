def _cone_of_cold(conn, user_id: int, campaign_id: int):
    return {}

cone_of_cold_item = {
    "key": "cone_of_cold",
    "name": "Cone of Cold",
    "description": "Blur the board heavily, then partially, across the next 2 guesses.",
    "cost": 2,
    "category": "illusion",
    "handler": _cone_of_cold,
    "affects_others": True,
    "requires_target": True,
    "exclusive_with": ["spider_swarm"]
}
