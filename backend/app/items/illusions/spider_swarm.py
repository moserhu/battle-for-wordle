def _spider_swarm(conn, user_id: int, campaign_id: int):
    return {}

spider_swarm_item = {
    "key": "spider_swarm",
    "name": "Spider Swarm",
    "description": "A skittering omen crosses the board.",
    "cost": 5,
    "category": "illusion",
    "handler": _spider_swarm,
    "affects_others": True,
    "requires_target": True,
    "exclusive_with": ["cone_of_cold"]
}
