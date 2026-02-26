import json
import os
import sys
import unittest
from datetime import datetime
from unittest.mock import patch


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
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
  def __init__(self, select_row=None):
    self.select_row = select_row
    self.calls = []

  def execute(self, query, params=None):
    self.calls.append((query, params))
    if "SELECT items" in query:
      return _FakeCursor(self.select_row)
    return _FakeCursor(None)


class ShopRotationPersistenceTests(unittest.TestCase):
  def setUp(self):
    if crud is None:
      self.skipTest(f"backend app.crud import unavailable: {IMPORT_ERROR}")

  def test_get_shop_day_formats_resolved_target_date(self):
    fake_date = datetime(2026, 2, 26)
    with patch.object(crud, "resolve_campaign_day", return_value=(None, None, None, None, fake_date)):
      result = crud._get_shop_day(object(), 9)
    self.assertEqual(result, "2026-02-26")

  def test_get_or_create_shop_rotation_returns_normalized_json_rotation(self):
    conn = _FakeConn(select_row=(json.dumps({"illusion": ["i1"], "blessing": [], "curse": ["c1"]}),))
    with patch.object(crud, "_normalize_shop_rotation", return_value={"illusion": ["i1"], "blessing": ["b1"], "curse": ["c1"]}) as mock_norm:
      result = crud._get_or_create_shop_rotation(conn, 1, 2, "2026-02-26")
    self.assertEqual(result["blessing"], ["b1"])
    mock_norm.assert_called_once()
    update_calls = [c for c in conn.calls if "UPDATE campaign_shop_rotation" in c[0]]
    self.assertEqual(update_calls, [])

  def test_get_or_create_shop_rotation_migrates_legacy_list_and_persists_normalized_json(self):
    conn = _FakeConn(select_row=(["i1", "b1"],))
    normalized = {"illusion": ["i1"], "blessing": ["b1"], "curse": ["c1"]}
    with patch.object(crud, "_normalize_shop_rotation", return_value=normalized):
      result = crud._get_or_create_shop_rotation(conn, 5, 6, "2026-02-26")

    self.assertEqual(result, normalized)
    update_calls = [c for c in conn.calls if "UPDATE campaign_shop_rotation" in c[0]]
    self.assertEqual(len(update_calls), 1)
    params = update_calls[0][1]
    self.assertEqual(json.loads(params[0]), normalized)
    self.assertEqual(params[1:], (5, 6, "2026-02-26"))

  def test_get_or_create_shop_rotation_creates_new_rotation_on_invalid_json(self):
    conn = _FakeConn(select_row=("{not-json",))
    selection = {"illusion": ["i2"], "blessing": ["b2"], "curse": ["c2"]}
    with patch.object(crud, "_select_shop_items_by_category", return_value=selection):
      result = crud._get_or_create_shop_rotation(conn, 9, 10, "2026-02-26")

    self.assertEqual(result, selection)
    insert_calls = [c for c in conn.calls if "INSERT INTO campaign_shop_rotation" in c[0]]
    self.assertEqual(len(insert_calls), 1)
    params = insert_calls[0][1]
    self.assertEqual(params[0:3], (9, 10, "2026-02-26"))
    self.assertEqual(json.loads(params[3]), selection)


if __name__ == "__main__":
  unittest.main()
