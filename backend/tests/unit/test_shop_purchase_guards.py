import os
import sys
import unittest
from unittest.mock import patch


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_ROOT not in sys.path:
  sys.path.insert(0, BACKEND_ROOT)

try:
  from app import crud  # noqa: E402
except Exception as exc:  # pragma: no cover
  crud = None
  IMPORT_ERROR = exc
else:
  IMPORT_ERROR = None


class _FakeCursor:
  def __init__(self, row):
    self._row = row

  def fetchone(self):
    return self._row


class _FakeConn:
  def __init__(self):
    self.calls = []

  def execute(self, query, params=None):
    self.calls.append((query, params))
    normalized_query = " ".join(query.split())
    if "FROM campaign_shop_log" in normalized_query and "LIMIT 1" in normalized_query:
      return _FakeCursor(None)
    if "SELECT coins" in normalized_query and "FROM campaign_coins" in normalized_query:
      return _FakeCursor((10,))
    if "RETURNING quantity" in normalized_query:
      return _FakeCursor((1,))
    if "SELECT COALESCE(SUM(cost), 0)" in normalized_query and "FROM store_purchases" in normalized_query:
      return _FakeCursor((0,))
    return _FakeCursor(None)


class _FakeDbCtx:
  def __init__(self, conn):
    self.conn = conn

  def __enter__(self):
    return self.conn

  def __exit__(self, exc_type, exc, tb):
    return False


class ShopPurchaseGuardsTests(unittest.TestCase):
  def setUp(self):
    if crud is None:
      self.skipTest(f"backend app.crud import unavailable: {IMPORT_ERROR}")

  def test_purchase_rejects_item_not_in_todays_rotation(self):
    conn = _FakeConn()
    item = {
      "key": "candle_of_mercy",
      "name": "Candle of Mercy",
      "cost": 5,
      "category": "blessing",
    }
    with (
      patch.object(crud, "get_item", return_value=item),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "is_admin_campaign", return_value=False),
      patch.object(crud, "_get_shop_day", return_value="2026-03-01"),
      patch.object(crud, "_get_or_create_shop_rotation", return_value={"illusion": ["cone_of_cold"], "blessing": ["oracle_whisper"], "curse": ["reapers_scythe"]}),
    ):
      with self.assertRaises(Exception) as ctx:
        crud.purchase_item(user_id=1, campaign_id=9, item_key="candle_of_mercy")

    self.assertEqual(getattr(ctx.exception, "status_code", None), 400)
    self.assertIn("not currently available", getattr(ctx.exception, "detail", str(ctx.exception)).lower())
    self.assertEqual(len(conn.calls), 0)

  def test_purchase_allows_item_in_todays_rotation(self):
    conn = _FakeConn()
    item = {
      "key": "candle_of_mercy",
      "name": "Candle of Mercy",
      "cost": 5,
      "category": "blessing",
    }
    with (
      patch.object(crud, "get_item", return_value=item),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "is_admin_campaign", return_value=True),
      patch.object(crud, "_get_shop_day", return_value="2026-03-01"),
      patch.object(crud, "_get_or_create_shop_rotation", return_value={"illusion": ["cone_of_cold"], "blessing": ["candle_of_mercy"], "curse": ["reapers_scythe"]}),
    ):
      result = crud.purchase_item(user_id=1, campaign_id=9, item_key="candle_of_mercy")

    self.assertEqual(result["coins"], 5)
    self.assertEqual(result["quantity"], 1)
    self.assertEqual(result["item"]["key"], "candle_of_mercy")


if __name__ == "__main__":
  unittest.main()
