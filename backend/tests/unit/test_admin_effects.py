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
  from fastapi import HTTPException
  from app.admin import service  # noqa: E402
except Exception as exc:  # pragma: no cover
  service = None
  HTTPException = None
  IMPORT_ERROR = exc
else:
  IMPORT_ERROR = None


class _FakeCursor:
  def __init__(self, row=None):
    self._row = row

  def fetchone(self):
    return self._row


class _FakeConn:
  def __init__(self):
    self.inserted_event_details = None
    self.inserted_status = None
    self.current_score = 20
    self.updated_score = None
    self.infernal_effect_value = None
    self.updated_infernal_payload = None

  def execute(self, query, params=None):
    normalized = " ".join(query.split())
    if "SELECT score FROM campaign_members" in normalized:
      return _FakeCursor((self.current_score,))
    if "FROM campaign_members" in normalized:
      return _FakeCursor((1,))
    if "UPDATE campaign_members SET score = %s" in normalized:
      self.updated_score = params[0]
      self.current_score = params[0]
      return _FakeCursor(None)
    if "SELECT effect_value FROM campaign_user_status_effects" in normalized and "infernal_mandate" in str(params):
      return _FakeCursor((self.infernal_effect_value,))
    if "UPDATE campaign_user_status_effects SET effect_value = %s" in normalized and "infernal_mandate" in str(params):
      self.updated_infernal_payload = params[0]
      self.infernal_effect_value = params[0]
      return _FakeCursor(None)
    if "SELECT word FROM campaign_words" in normalized:
      return _FakeCursor(("level",))
    if "INSERT INTO campaign_item_events" in normalized:
      self.inserted_event_details = params[5]
      return _FakeCursor(None)
    if "INSERT INTO campaign_user_status_effects" in normalized:
      self.inserted_status = {
        "effect_key": params[2],
        "effect_value": params[3],
      }
      return _FakeCursor(None)
    return _FakeCursor(None)


class _FakeDbCtx:
  def __init__(self, conn):
    self.conn = conn

  def __enter__(self):
    return self.conn

  def __exit__(self, exc_type, exc, tb):
    return False


class AdminEffectsTests(unittest.TestCase):
  def setUp(self):
    if service is None:
      self.skipTest(f"backend app.admin.service import unavailable: {IMPORT_ERROR}")

  def test_list_admin_effects_exposes_custom_payload_types(self):
    conn = _FakeConn()
    with (
      patch.object(service, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(service, "require_admin", return_value=None),
    ):
      effects = service.list_admin_effects(user_id=1)

    by_key = {entry["key"]: entry for entry in effects}
    self.assertEqual(by_key["vowel_voodoo"]["payload_type"], "vowels")
    self.assertEqual(by_key["consonant_cleaver"]["payload_type"], "letters")
    self.assertEqual(by_key["veil_of_obscured_sight"]["payload_type"], "side")

  def test_admin_add_effect_supports_manual_consonant_payload(self):
    conn = _FakeConn()
    item = {
      "key": "consonant_cleaver",
      "name": "Consonant Cleaver",
      "category": "curse",
      "affects_others": True,
      "requires_target": True,
    }
    with (
      patch.object(service, "get_item", return_value=item),
      patch.object(service, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(service, "require_admin", return_value=None),
      patch.object(service, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
    ):
      result = service.admin_add_effect(
        user_id=1,
        campaign_id=99,
        effect_key="consonant_cleaver",
        effect_payload={"value": "bcdf"},
      )

    details = json.loads(conn.inserted_event_details)
    self.assertEqual(details["payload"]["type"], "letters")
    self.assertEqual(details["payload"]["value"], "bcdf")
    self.assertEqual(result["effect_type"], "target")

  def test_admin_add_effect_rejects_invalid_vowel_payload(self):
    conn = _FakeConn()
    item = {
      "key": "vowel_voodoo",
      "name": "Vowel Voodoo",
      "category": "curse",
      "affects_others": True,
      "requires_target": True,
    }
    with (
      patch.object(service, "get_item", return_value=item),
      patch.object(service, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(service, "require_admin", return_value=None),
      patch.object(service, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
    ):
      with self.assertRaises(HTTPException) as ctx:
        service.admin_add_effect(
          user_id=1,
          campaign_id=99,
          effect_key="vowel_voodoo",
          effect_payload={"value": "ab"},
        )
    self.assertEqual(ctx.exception.status_code, 400)
    self.assertIn("two vowels", ctx.exception.detail.lower())

  def test_admin_add_effect_dispel_sets_cursed_marker(self):
    conn = _FakeConn()
    item = {
      "key": "dispel_curse",
      "name": "Dispel Curse",
      "category": "blessing",
      "affects_others": False,
      "requires_target": False,
    }
    with (
      patch.object(service, "get_item", return_value=item),
      patch.object(service, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(service, "require_admin", return_value=None),
      patch.object(service, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
    ):
      result = service.admin_add_effect(
        user_id=1,
        campaign_id=99,
        effect_key="dispel_curse",
        effect_payload=None,
      )

    self.assertEqual(conn.inserted_status["effect_key"], "cursed")
    payload = json.loads(conn.inserted_status["effect_value"])
    self.assertEqual(payload["day"], 2)
    self.assertEqual(result["effect_type"], "status")

  def test_admin_add_effect_twin_fates_generates_day_payload(self):
    conn = _FakeConn()
    item = {
      "key": "twin_fates",
      "name": "Twin Fates",
      "category": "blessing",
      "affects_others": False,
      "requires_target": False,
    }
    with (
      patch.object(service, "get_item", return_value=item),
      patch.object(service, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(service, "require_admin", return_value=None),
      patch.object(service, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
    ):
      result = service.admin_add_effect(
        user_id=1,
        campaign_id=99,
        effect_key="twin_fates",
        effect_payload=None,
      )

    self.assertEqual(conn.inserted_status["effect_key"], "twin_fates")
    payload = json.loads(conn.inserted_status["effect_value"])
    self.assertEqual(payload["day"], 2)
    self.assertTrue(any(entry["letter"] == "L" for entry in payload["letters"]))
    self.assertEqual(result["effect_type"], "status")

  def test_admin_add_troops_updates_score(self):
    conn = _FakeConn()
    with (
      patch.object(service, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(service, "require_admin", return_value=None),
    ):
      result = service.admin_add_troops(user_id=1, campaign_id=99, amount=5)

    self.assertEqual(conn.updated_score, 25)
    self.assertEqual(result["score"], 25)

  def test_admin_reset_day_resets_infernal_daily_penalty_usage(self):
    conn = _FakeConn()
    conn.infernal_effect_value = json.dumps({"day": 2, "penalty_applied": 15})
    with (
      patch.object(service, "get_db", return_value=_FakeDbCtx(conn)),
      patch.object(service, "require_admin", return_value=None),
      patch.object(service, "resolve_campaign_day", return_value=(None, 7, 2, 2, date(2026, 3, 1))),
    ):
      result = service.admin_reset_day(user_id=1, campaign_id=99)

    self.assertEqual(result["status"], "reset")
    self.assertIsNotNone(conn.updated_infernal_payload)
    payload = json.loads(conn.updated_infernal_payload)
    self.assertEqual(payload["day"], 2)
    self.assertEqual(payload["penalty_applied"], 0)


if __name__ == "__main__":
  unittest.main()
