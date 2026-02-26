def _dance_of_the_jester(conn, user_id: int, campaign_id: int):
    return {}

dance_of_the_jester_item = {
    "key": "dance_of_the_jester",
    "name": "Dance of the Jester",
    "description": "Mocking laughter stirs the tiles with a restless jig.",
    "cost": 4,
    "category": "illusion",
    "handler": _dance_of_the_jester,
    "affects_others": True,
    "requires_target": True
}
