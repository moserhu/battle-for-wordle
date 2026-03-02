def _phantoms_mirage(conn, user_id: int, campaign_id: int):
    return {}

phantoms_mirage_item = {
    "key": "phantoms_mirage",
    "name": "Phantom's Mirage",
    "description": "Confirmed green letters render red instead of green.",
    "cost": 1,
    "category": "illusion",
    "handler": _phantoms_mirage,
    "affects_others": True,
    "requires_target": True
}
