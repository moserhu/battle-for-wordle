import json
import os
import sys
import unittest
from datetime import date
from unittest.mock import patch


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if BACKEND_ROOT not in sys.path:
  sys.path.insert(0, BACKEND_ROOT)

try:
  from fastapi import HTTPException
  from app import crud  # noqa: E402
except Exception as exc:  # pragma: no cover
  crud = None
  HTTPException = None
  IMPORT_ERROR = exc
else:
  IMPORT_ERROR = None


class _FakeCursor:
  def __init__(self, row):
    self._row = row

  def fetchone(self):
    return self._row

  def fetchall(self):
    return self._row or []


class _FakeConn:
  def __init__(self, cursed_row=None, curse_event=False, qty=0, score=10, guess_state_row=None, blessing_today=False):
    self.cursed_row = cursed_row
    self.curse_event = curse_event
    self.qty = qty
    self.score = score
    self.guess_state_row = guess_state_row
    self.blessing_today = blessing_today

  def execute(self, query, params=None):
    normalized = " ".join(query.split())
    if "SELECT score" in normalized and "FROM campaign_members" in normalized:
      return _FakeCursor((self.score,))
    if "FROM campaign_item_events" in normalized and "details, '{}')::jsonb->>'category' = %s" in normalized:
      return _FakeCursor((1,) if self.blessing_today else None)
    if "FROM campaign_guess_states" in normalized and "SELECT game_over, current_row" in normalized:
      return _FakeCursor(self.guess_state_row)
    if "FROM campaign_user_status_effects" in normalized and "effect_key = %s" in normalized and "cursed" in str(params):
      return _FakeCursor(self.cursed_row)
    if "FROM campaign_item_events" in normalized and "item_key = ANY(%s)" in normalized:
      return _FakeCursor((1,) if self.curse_event else None)
    if "FROM campaign_user_items" in normalized and "SELECT quantity" in normalized:
      return _FakeCursor((self.qty,))
    if "SELECT COUNT(*)" in normalized and "FROM campaign_item_events" in normalized:
      return _FakeCursor((0,))
    return _FakeCursor(None)


class _EffectsConn:
  def __init__(self, effect_rows=None, cursed_row=None):
    self.effect_rows = effect_rows or []
    self.cursed_row = cursed_row

  def execute(self, query, params=None):
    normalized = " ".join(query.split())
    if "SELECT item_key, details" in normalized and "FROM campaign_item_events" in normalized:
      return _FakeCursor(self.effect_rows)
    if "FROM campaign_user_status_effects" in normalized and "effect_key = %s" in normalized and "cursed" in str(params):
      return _FakeCursor(self.cursed_row)
    return _FakeCursor(None)


class _StatusConn:
  def __init__(self, rows):
    self.rows = rows

  def execute(self, query, params=None):
    normalized = " ".join(query.split())
    if "SELECT effect_key, effect_value, expires_at" in normalized and "FROM campaign_user_status_effects" in normalized:
      return _FakeCursor(self.rows)
    return _FakeCursor(None)


class _FakeDbCtx:
  def __init__(self, conn):
    self.conn = conn

  def __enter__(self):
    return self.conn

  def __exit__(self, exc_type, exc, tb):
    return False


class ItemEffectGuardTests(unittest.TestCase):
  def setUp(self):
    if crud is None:
      self.skipTest(f"backend app.crud import unavailable: {IMPORT_ERROR}")

  def test_is_curse_lock_dispersed_for_day_true_when_inactive_marker_matches_day(self):
    payload = json.dumps({"day": 3, "dispelled": True})
    conn = _FakeConn(cursed_row=(payload, False))
    result = crud._is_curse_lock_dispersed_for_day(conn, user_id=1, campaign_id=2, target_day=3)
    self.assertTrue(result)

  def test_is_curse_lock_dispersed_for_day_false_when_row_active(self):
    payload = json.dumps({"day": 3, "dispelled": True})
    conn = _FakeConn(cursed_row=(payload, True))
    result = crud._is_curse_lock_dispersed_for_day(conn, user_id=1, campaign_id=2, target_day=3)
    self.assertFalse(result)

  def test_has_active_curse_effect_today_true_when_event_exists(self):
    conn = _FakeConn(curse_event=True)
    result = crud._has_active_curse_effect_today(conn, user_id=1, campaign_id=2, target_date_str="2026-03-01")
    self.assertTrue(result)

  def test_use_item_blocks_blessings_while_hexed(self):
    blessing = {
      "key": "oracle_whisper",
      "name": "Oracle Whisper",
      "category": "blessing",
      "affects_others": False,
      "requires_target": False,
    }
    conn = _FakeConn()
    with (
      patch.object(crud, "get_item", return_value=blessing),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
      patch.object(crud, "_has_active_curse_effect_today", return_value=True),
      patch.object(crud, "_is_curse_lock_dispersed_for_day", return_value=False),
    ):
      with self.assertRaises(HTTPException) as ctx:
        crud.use_item(user_id=10, campaign_id=20, item_key="oracle_whisper", target_user_id=None, effect_payload=None)

    self.assertEqual(ctx.exception.status_code, 400)
    self.assertIn("may not use blessings", ctx.exception.detail.lower())

  def test_use_item_allows_blessing_after_dispel_marker_then_hits_normal_inventory_guard(self):
    blessing = {
      "key": "oracle_whisper",
      "name": "Oracle Whisper",
      "category": "blessing",
      "affects_others": False,
      "requires_target": False,
    }
    conn = _FakeConn(qty=0)
    with (
      patch.object(crud, "get_item", return_value=blessing),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
      patch.object(crud, "_has_active_curse_effect_today", return_value=True),
      patch.object(crud, "_is_curse_lock_dispersed_for_day", return_value=True),
    ):
      with self.assertRaises(HTTPException) as ctx:
        crud.use_item(
          user_id=10,
          campaign_id=20,
          item_key="oracle_whisper",
          target_user_id=None,
          effect_payload=None,
          accept_blessing_cost=True,
        )

    self.assertEqual(ctx.exception.status_code, 400)
    self.assertIn("item not available", ctx.exception.detail.lower())

  def test_use_item_blocks_blessing_when_troops_below_sacrifice_cost(self):
    blessing = {
      "key": "oracle_whisper",
      "name": "Oracle Whisper",
      "category": "blessing",
      "affects_others": False,
      "requires_target": False,
    }
    conn = _FakeConn(qty=1, score=0)
    with (
      patch.object(crud, "get_item", return_value=blessing),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
      patch.object(crud, "_has_active_curse_effect_today", return_value=False),
      patch.object(crud, "_is_curse_lock_dispersed_for_day", return_value=False),
    ):
      with self.assertRaises(HTTPException) as ctx:
        crud.use_item(
          user_id=10,
          campaign_id=20,
          item_key="oracle_whisper",
          target_user_id=None,
          effect_payload=None,
          accept_blessing_cost=True,
          consume_candle_of_mercy=False,
        )

    self.assertEqual(ctx.exception.status_code, 400)
    self.assertIn("not enough troops", ctx.exception.detail.lower())
    self.assertEqual(conn.qty, 1)

  def test_use_item_blocks_blessing_after_current_day_played(self):
    blessing = {
      "key": "oracle_whisper",
      "name": "Oracle Whisper",
      "category": "blessing",
      "affects_others": False,
      "requires_target": False,
    }
    conn = _FakeConn(qty=1, score=20, guess_state_row=(True, 2))
    with (
      patch.object(crud, "get_item", return_value=blessing),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
      patch.object(crud, "_has_active_curse_effect_today", return_value=False),
      patch.object(crud, "_is_curse_lock_dispersed_for_day", return_value=False),
    ):
      with self.assertRaises(HTTPException) as ctx:
        crud.use_item(
          user_id=10,
          campaign_id=20,
          item_key="oracle_whisper",
          target_user_id=None,
          effect_payload=None,
          accept_blessing_cost=True,
        )

    self.assertEqual(ctx.exception.status_code, 400)
    self.assertIn("before you have played the current day", ctx.exception.detail.lower())

  def test_use_item_blocks_second_blessing_same_day(self):
    blessing = {
      "key": "oracle_whisper",
      "name": "Oracle Whisper",
      "category": "blessing",
      "affects_others": False,
      "requires_target": False,
    }
    conn = _FakeConn(qty=1, score=20, blessing_today=True)
    with (
      patch.object(crud, "get_item", return_value=blessing),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
      patch.object(crud, "_has_active_curse_effect_today", return_value=False),
      patch.object(crud, "_is_curse_lock_dispersed_for_day", return_value=False),
    ):
      with self.assertRaises(HTTPException) as ctx:
        crud.use_item(
          user_id=10,
          campaign_id=20,
          item_key="oracle_whisper",
          target_user_id=None,
          effect_payload=None,
          accept_blessing_cost=True,
        )

    self.assertEqual(ctx.exception.status_code, 400)
    self.assertIn("only one blessing", ctx.exception.detail.lower())

  def test_use_item_allows_dispel_curse_without_sacrifice_confirmation(self):
    dispel = {
      "key": "dispel_curse",
      "name": "Dispel Curse",
      "category": "blessing",
      "affects_others": False,
      "requires_target": False,
    }
    conn = _FakeConn(qty=1, score=0)
    with (
      patch.object(crud, "get_item", return_value=dispel),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
      patch.object(crud, "_has_active_curse_effect_today", return_value=True),
      patch.object(crud, "_is_curse_lock_dispersed_for_day", return_value=False),
    ):
      result = crud.use_item(
        user_id=10,
        campaign_id=20,
        item_key="dispel_curse",
        target_user_id=None,
        effect_payload=None,
        accept_blessing_cost=False,
        consume_candle_of_mercy=False,
      )

    self.assertEqual(result["item_key"], "dispel_curse")
    self.assertEqual(result["blessing_troop_cost_applied"], 0)
    self.assertFalse(result["candle_consumed"])

  def test_use_item_allows_dispel_curse_even_if_blessing_already_used_today(self):
    dispel = {
      "key": "dispel_curse",
      "name": "Dispel Curse",
      "category": "blessing",
      "affects_others": False,
      "requires_target": False,
    }
    conn = _FakeConn(qty=1, score=0, blessing_today=True)
    with (
      patch.object(crud, "get_item", return_value=dispel),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
      patch.object(crud, "_has_active_curse_effect_today", return_value=True),
      patch.object(crud, "_is_curse_lock_dispersed_for_day", return_value=False),
    ):
      result = crud.use_item(
        user_id=10,
        campaign_id=20,
        item_key="dispel_curse",
        target_user_id=None,
        effect_payload=None,
        accept_blessing_cost=False,
        consume_candle_of_mercy=False,
      )

    self.assertEqual(result["item_key"], "dispel_curse")
    self.assertEqual(result["blessing_troop_cost_applied"], 0)
    self.assertFalse(result["candle_consumed"])

  def test_get_active_target_effects_returns_curse_dispersed_flag(self):
    effect_rows = [
      ("vowel_voodoo", json.dumps({"payload": {"type": "vowels", "value": "ae"}})),
      ("oracle_whisper", json.dumps({"hint": {"letter": "a"}})),
    ]
    cursed_row = (json.dumps({"day": 2, "dispelled": True}), False)
    conn = _EffectsConn(effect_rows=effect_rows, cursed_row=cursed_row)
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
    ):
      payload = crud.get_active_target_effects(user_id=10, campaign_id=20)

    keys = [entry["item_key"] for entry in payload["effects"]]
    self.assertIn("vowel_voodoo", keys)
    self.assertIn("oracle_whisper", keys)
    self.assertTrue(payload["curse_dispersed"])

  def test_get_current_status_effects_filters_old_day_twin_and_easy_tongue(self):
    rows = [
      ("twin_fates", json.dumps({"day": 1, "letters": [{"letter": "A", "positions": [1, 3]}]}), None),
      ("vowel_vision", json.dumps({"day": 1, "vowel_count": 2}), None),
      ("twin_fates", json.dumps({"day": 2, "letters": [{"letter": "E", "positions": [2, 5]}]}), None),
      ("vowel_vision", json.dumps({"day": 2, "vowel_count": 3}), None),
    ]
    conn = _StatusConn(rows)
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
    ):
      payload = crud.get_current_status_effects(user_id=10, campaign_id=20)

    keys = [entry["effect_key"] for entry in payload["effects"]]
    self.assertEqual(keys.count("twin_fates"), 1)
    self.assertEqual(keys.count("vowel_vision"), 1)
    twin = next(entry for entry in payload["effects"] if entry["effect_key"] == "twin_fates")
    easy = next(entry for entry in payload["effects"] if entry["effect_key"] == "vowel_vision")
    self.assertEqual(twin["payload"]["day"], 2)
    self.assertEqual(easy["payload"]["day"], 2)


if __name__ == "__main__":
  unittest.main()
