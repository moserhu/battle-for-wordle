def _sigil_of_the_wandering_glyph(conn, user_id: int, campaign_id: int):
    return {}


sigil_of_the_wandering_glyph_item = {
    "key": "sigil_of_the_wandering_glyph",
    "name": "Sigil of the Wandering Glyph",
    "description": "A bouncing rune ricochets around the screen.",
    "cost": 1,
    "category": "illusion",
    "handler": _sigil_of_the_wandering_glyph,
    "affects_others": True,
    "requires_target": True
}
