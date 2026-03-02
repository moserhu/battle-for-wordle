import json
import os
import sys
import unittest
from datetime import date
from unittest.mock import patch


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_ROOT not in sys.path:
  sys.path.insert(0, BACKEND_ROOT)

try:
  from app import crud  # noqa: E402
  from app.items import get_item  # noqa: E402
except Exception as exc:  # pragma: no cover
  crud = None
  get_item = None
  IMPORT_ERROR = exc
else:
  IMPORT_ERROR = None


class _FakeCursor:
  def __init__(self, row):
    self._row = row

  def fetchall(self):
    return self._row or []


class _EffectsConn:
  def __init__(self, rows):
    self.rows = rows

  def execute(self, query, params=None):
    normalized = " ".join(query.split())
    if "SELECT item_key, details FROM campaign_item_events" in normalized:
      return _FakeCursor(self.rows)
    return _FakeCursor([])


class _FakeDbCtx:
  def __init__(self, conn):
    self.conn = conn

  def __enter__(self):
    return self.conn

  def __exit__(self, exc_type, exc, tb):
    return False


class ItemKeyAliasTests(unittest.TestCase):
  def setUp(self):
    if crud is None or get_item is None:
      self.skipTest(f"backend import unavailable: {IMPORT_ERROR}")

  def test_get_item_resolves_legacy_keys(self):
    self.assertEqual(get_item("executioners_cut")["key"], "reapers_scythe")
    self.assertEqual(get_item("edict_of_compulsion")["key"], "hex_of_forced_utterance")
    self.assertEqual(get_item("cartographers_insight")["key"], "grace_of_the_guiding_star")
    self.assertEqual(get_item("dance_of_the_jester")["key"], "earthquake")
    self.assertEqual(get_item("blood_oath_ink")["key"], "phantoms_mirage")

  def test_get_active_target_effects_canonicalizes_item_key(self):
    rows = [
      ("executioners_cut", json.dumps({"payload": {"type": "none"}, "effective_on": "2026-03-01"})),
      ("edict_of_compulsion", "{bad-json"),
    ]
    conn = _EffectsConn(rows)
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
    ):
      result = crud.get_active_target_effects(user_id=11, campaign_id=22)

    self.assertEqual(result["day"], 2)
    self.assertEqual(result["effects"][0]["item_key"], "reapers_scythe")
    self.assertEqual(result["effects"][1]["item_key"], "hex_of_forced_utterance")
    self.assertEqual(result["effects"][1]["details"], {"raw": "{bad-json"})

  def test_get_active_target_effects_empty_rows_returns_empty_effects(self):
    conn = _EffectsConn([])
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
    ):
      result = crud.get_active_target_effects(user_id=11, campaign_id=22)

    self.assertEqual(result, {"day": 2, "effects": []})


if __name__ == "__main__":
  unittest.main()
