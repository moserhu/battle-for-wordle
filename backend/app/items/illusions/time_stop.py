def _time_stop(conn, user_id: int, campaign_id: int):
    return {}


time_stop_item = {
    "key": "time_stop",
    "name": "Time Stop",
    "description": "Slow down letter reveal timing for each guess.",
    "cost": 2,
    "category": "illusion",
    "handler": _time_stop,
    "affects_others": True,
    "requires_target": True
}
