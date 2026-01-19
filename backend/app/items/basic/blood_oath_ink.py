def _blood_oath_ink(conn, user_id: int, campaign_id: int):
    return {}

blood_oath_ink_item = {
    "key": "blood_oath_ink",
    "name": "Blood Oath Ink",
    "description": "Victory stains the tiles with a darker vow.",
    "cost": 3,
    "category": "basic",
    "handler": _blood_oath_ink,
    "affects_others": True,
    "requires_target": True
}
