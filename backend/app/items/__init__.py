from app.items.illusions import ILLUSION_ITEMS
from app.items.blessings import BLESSING_ITEMS
from app.items.curses import CURSE_ITEMS

ITEM_CATALOG = ILLUSION_ITEMS + BLESSING_ITEMS + CURSE_ITEMS


def get_item(item_key: str):
    return next((item for item in ITEM_CATALOG if item["key"] == item_key), None)
