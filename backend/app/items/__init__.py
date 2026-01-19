from app.items.basic import BASIC_ITEMS
from app.items.spells import SPELL_ITEMS
from app.items.curses import CURSE_ITEMS

ITEM_CATALOG = BASIC_ITEMS + SPELL_ITEMS + CURSE_ITEMS

def get_item(item_key: str):
    return next((item for item in ITEM_CATALOG if item["key"] == item_key), None)
