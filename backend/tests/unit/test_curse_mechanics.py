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


class _UseItemConn:
  def __init__(self, qty=1):
    self.qty = qty
    self.last_event_details = None

  def execute(self, query, params=None):
    normalized = " ".join(query.split())
    if "FROM campaign_members" in normalized and "WHERE campaign_id = %s AND user_id = %s" in normalized:
      return _FakeCursor((1,))
    if "SELECT quantity" in normalized and "FROM campaign_user_items" in normalized:
      return _FakeCursor((self.qty,))
    if "UPDATE campaign_user_items" in normalized and "SET quantity = quantity - 1" in normalized:
      self.qty = max(self.qty - 1, 0)
      return _FakeCursor(None)
    if "SELECT display_name" in normalized and "FROM campaign_members" in normalized:
      return _FakeCursor(("Caster",))
    if "FROM campaign_item_events" in normalized and "effective_on" in normalized and "LIMIT 1" in normalized:
      return _FakeCursor(None)
    if "INSERT INTO campaign_item_events" in normalized:
      # (user_id, campaign_id, item_key, target_user_id, event_type, details)
      self.last_event_details = params[5]
      return _FakeCursor(None)
    return _FakeCursor(None)


class _ValidateConn:
  def __init__(self, effect_rows=None, guess_state=None, cursed_row=None):
    self.effect_rows = effect_rows or []
    self.cursed_row = cursed_row
    if guess_state is None:
      guess_state = (
        json.dumps([["", "", "", "", ""] for _ in range(6)]),
        json.dumps([None] * 6),
        json.dumps({}),
        0,
        0,
      )
    self.guess_state = guess_state
    self.committed = False

  def execute(self, query, params=None):
    normalized = " ".join(query.split())
    if normalized == "BEGIN":
      return _FakeCursor(None)
    if "SELECT word FROM campaign_words" in normalized:
      return _FakeCursor(("cigar",))
    if "FROM campaign_guesses" in normalized and "word = %s" in normalized:
      return _FakeCursor(None)
    if "FROM campaign_guess_states" in normalized and "SELECT guesses, results, letter_status, current_row, game_over" in normalized:
      return _FakeCursor(self.guess_state)
    if "SELECT item_key, details" in normalized and "FROM campaign_item_events" in normalized:
      return _FakeCursor(self.effect_rows)
    if "FROM campaign_user_status_effects" in normalized and "effect_key = %s" in normalized and "cursed" in str(params):
      return _FakeCursor(self.cursed_row)
    if "FROM campaign_user_status_effects" in normalized and "send_in_the_clown" in str(params):
      return _FakeCursor(None)
    if "UPDATE users" in normalized and "total_guesses" in normalized:
      raise RuntimeError("stop-after-hardmode-check")
    return _FakeCursor(None)

  def commit(self):
    self.committed = True


class _ValidateConnNoStop(_ValidateConn):
  def execute(self, query, params=None):
    normalized = " ".join(query.split())
    if "UPDATE users" in normalized and "total_guesses" in normalized:
      return _FakeCursor(None)
    return super().execute(query, params)


class _FakeDbCtx:
  def __init__(self, conn):
    self.conn = conn

  def __enter__(self):
    return self.conn

  def __exit__(self, exc_type, exc, tb):
    return False


class CurseMechanicsTests(unittest.TestCase):
  def setUp(self):
    if crud is None:
      self.skipTest(f"backend app.crud import unavailable: {IMPORT_ERROR}")

  def test_use_item_vowel_voodoo_stores_two_vowels_payload(self):
    item = {
      "key": "vowel_voodoo",
      "name": "Vowel Voodoo",
      "category": "curse",
      "affects_others": True,
      "requires_target": True,
      "exclusive_all": True,
    }
    conn = _UseItemConn(qty=1)
    with (
      patch.object(crud, "get_item", return_value=item),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=True),
      patch.object(crud, "random", wraps=crud.random) as mock_random,
    ):
      mock_random.sample.return_value = ["a", "e"]
      result = crud.use_item(1, 99, "vowel_voodoo", 2, None)

    payload = json.loads(conn.last_event_details)
    self.assertEqual(payload["payload"]["type"], "vowels")
    self.assertEqual(payload["payload"]["value"], "ae")
    self.assertEqual(result["item_key"], "vowel_voodoo")

  def test_use_item_consonant_cleaver_stores_four_consonants(self):
    item = {
      "key": "consonant_cleaver",
      "name": "Consonant Cleaver",
      "category": "curse",
      "affects_others": True,
      "requires_target": True,
      "exclusive_all": True,
    }
    conn = _UseItemConn(qty=1)
    with (
      patch.object(crud, "get_item", return_value=item),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=True),
      patch.object(crud, "random", wraps=crud.random) as mock_random,
    ):
      mock_random.sample.return_value = ["b", "c", "d", "f"]
      crud.use_item(1, 99, "consonant_cleaver", 2, None)

    payload = json.loads(conn.last_event_details)
    self.assertEqual(payload["payload"]["type"], "letters")
    self.assertEqual(payload["payload"]["value"], "bcdf")

  def test_use_item_veil_of_obscured_sight_randomizes_side_payload(self):
    item = {
      "key": "veil_of_obscured_sight",
      "name": "Veil of Obscured Sight",
      "category": "curse",
      "affects_others": True,
      "requires_target": True,
      "exclusive_all": True,
    }
    conn = _UseItemConn(qty=1)
    with (
      patch.object(crud, "get_item", return_value=item),
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=True),
      patch.object(crud, "random", wraps=crud.random) as mock_random,
    ):
      mock_random.choice.return_value = "left"
      crud.use_item(1, 99, "veil_of_obscured_sight", 2, None)

    payload = json.loads(conn.last_event_details)
    self.assertEqual(payload["payload"]["type"], "side")
    self.assertEqual(payload["payload"]["value"], "left")

  def test_validate_guess_blocks_vowel_voodoo_letters_first_two_rows(self):
    effect_rows = [
      ("vowel_voodoo", json.dumps({"payload": {"type": "vowels", "value": "ae"}, "effective_on": "2026-03-01"})),
    ]
    conn = _ValidateConn(effect_rows=effect_rows)
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
    ):
      with self.assertRaises(HTTPException) as ctx:
        crud.validate_guess("caper", user_id=1, campaign_id=2)

    self.assertEqual(ctx.exception.status_code, 400)
    self.assertIn("hexed vowel", ctx.exception.detail.lower())

  def test_validate_guess_allows_blocked_vowel_when_dispel_marker_active(self):
    effect_rows = [
      ("vowel_voodoo", json.dumps({"payload": {"type": "vowels", "value": "ae"}, "effective_on": "2026-03-01"})),
    ]
    cursed_row = (json.dumps({"day": 2, "dispelled": True}), False)
    conn = _ValidateConn(effect_rows=effect_rows, cursed_row=cursed_row)
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
    ):
      with self.assertRaises(RuntimeError) as ctx:
        crud.validate_guess("caper", user_id=1, campaign_id=2)

    self.assertIn("stop-after-hardmode-check", str(ctx.exception))

  def test_validate_guess_blocks_consonant_cleaver_letters(self):
    effect_rows = [
      ("consonant_cleaver", json.dumps({"payload": {"type": "letters", "value": "bcdf"}, "effective_on": "2026-03-01"})),
    ]
    conn = _ValidateConn(effect_rows=effect_rows)
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
    ):
      with self.assertRaises(HTTPException) as ctx:
        crud.validate_guess("cigar", user_id=1, campaign_id=2)

    self.assertEqual(ctx.exception.status_code, 400)
    self.assertIn("cleaved consonant", ctx.exception.detail.lower())

  def test_validate_guess_allows_consonant_cleaver_letters_after_second_row(self):
    effect_rows = [
      ("consonant_cleaver", json.dumps({"payload": {"type": "letters", "value": "bcdf"}, "effective_on": "2026-03-01"})),
    ]
    guess_state = (
      json.dumps([["", "", "", "", ""] for _ in range(6)]),
      json.dumps([None] * 6),
      json.dumps({}),
      2,
      0,
    )
    conn = _ValidateConn(effect_rows=effect_rows, guess_state=guess_state)
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
    ):
      with self.assertRaises(RuntimeError) as ctx:
        crud.validate_guess("cigar", user_id=1, campaign_id=2)

    self.assertIn("stop-after-hardmode-check", str(ctx.exception))

  def test_validate_guess_allows_vowel_voodoo_letters_after_second_row(self):
    effect_rows = [
      ("vowel_voodoo", json.dumps({"payload": {"type": "vowels", "value": "ae"}, "effective_on": "2026-03-01"})),
    ]
    guess_state = (
      json.dumps([["", "", "", "", ""] for _ in range(6)]),
      json.dumps([None] * 6),
      json.dumps({}),
      2,
      0,
    )
    conn = _ValidateConn(effect_rows=effect_rows, guess_state=guess_state)
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
    ):
      with self.assertRaises(RuntimeError) as ctx:
        crud.validate_guess("caper", user_id=1, campaign_id=2)

    self.assertIn("stop-after-hardmode-check", str(ctx.exception))

  def test_validate_guess_infernal_penalty_applies_for_invalid_word(self):
    effect_rows = [
      ("infernal_mandate", json.dumps({"effective_on": "2026-03-01"})),
    ]
    conn = _ValidateConn(effect_rows=effect_rows)
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
      patch.object(crud, "_apply_infernal_penalty", return_value=5) as mock_penalty,
    ):
      with self.assertRaises(HTTPException) as ctx:
        crud.validate_guess("zzzzz", user_id=1, campaign_id=2)

    self.assertEqual(ctx.exception.status_code, 400)
    self.assertEqual(ctx.exception.detail.get("message"), "Invalid word")
    self.assertEqual(ctx.exception.detail.get("infernal_penalty_applied"), 5)
    self.assertTrue(ctx.exception.detail.get("infernal_rule_broken"))
    self.assertEqual(ctx.exception.detail.get("infernal_violation_type"), "playable_word")
    mock_penalty.assert_called_once_with(conn, 1, 2, 2, 5)
    self.assertTrue(conn.committed)

  def test_validate_guess_infernal_hard_mode_violation_calls_penalty(self):
    guesses = [["c", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""]]
    results = [["present", None, None, None, None], None, None, None, None, None]
    guess_state = (json.dumps(guesses), json.dumps(results), json.dumps({}), 1, 0)
    effect_rows = [
      ("infernal_mandate", json.dumps({"effective_on": "2026-03-01"})),
    ]
    conn = _ValidateConn(effect_rows=effect_rows, guess_state=guess_state)
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
      patch.object(crud, "_apply_infernal_penalty", return_value=5) as mock_penalty,
    ):
      with self.assertRaises(RuntimeError) as ctx:
        crud.validate_guess("adieu", user_id=1, campaign_id=2)

    self.assertIn("stop-after-hardmode-check", str(ctx.exception))
    mock_penalty.assert_called_once_with(conn, 1, 2, 2, 5)

  def test_validate_guess_returns_infernal_penalty_for_hard_mode_violation(self):
    guesses = [["c", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""]]
    results = [["present", None, None, None, None], None, None, None, None, None]
    guess_state = (json.dumps(guesses), json.dumps(results), json.dumps({}), 1, 0)
    effect_rows = [
      ("infernal_mandate", json.dumps({"effective_on": "2026-03-01"})),
    ]
    conn = _ValidateConnNoStop(effect_rows=effect_rows, guess_state=guess_state)
    with (
      patch.object(crud, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(crud, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
      patch.object(crud, "is_admin_campaign", return_value=False),
      patch.object(crud, "VALID_WORDS", set(crud.VALID_WORDS) | {"arise"}),
    ):
      response = crud.validate_guess("arise", user_id=1, campaign_id=2)

    self.assertEqual(response.get("infernal_penalty_applied"), 5)
    self.assertEqual(response.get("infernal_violation_type"), "letters")


if __name__ == "__main__":
  unittest.main()
