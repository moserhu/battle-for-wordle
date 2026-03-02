def _spider_swarm(conn, user_id: int, campaign_id: int):
    return {}

spider_swarm_item = {
    "key": "spider_swarm",
    "name": "Spider Swarm",
    "description": "Sends spiders scurrying across the game board.",
    "cost": 1,
    "category": "illusion",
    "handler": _spider_swarm,
    "affects_others": True,
    "requires_target": True,
    "exclusive_with": ["cone_of_cold"]
}
