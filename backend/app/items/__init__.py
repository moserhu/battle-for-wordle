from app.items.illusions import ILLUSION_ITEMS
from app.items.blessings import BLESSING_ITEMS
from app.items.curses import CURSE_ITEMS

ITEM_CATALOG = ILLUSION_ITEMS + BLESSING_ITEMS + CURSE_ITEMS
SHOP_ITEM_CATALOG = [item for item in ITEM_CATALOG if not item.get("retired")]
LEGACY_ITEM_KEY_ALIASES = {
    "edict_of_compulsion": "hex_of_forced_utterance",
    "executioners_cut": "reapers_scythe",
    "cartographers_insight": "grace_of_the_guiding_star",
    "dance_of_the_jester": "earthquake",
    "blood_oath_ink": "phantoms_mirage",
}


def get_item(item_key: str):
    key = LEGACY_ITEM_KEY_ALIASES.get(item_key, item_key)
    return next((item for item in ITEM_CATALOG if item["key"] == key), None)
