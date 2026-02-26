import os
import sys
import unittest
from unittest.mock import patch


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if BACKEND_ROOT not in sys.path:
  sys.path.insert(0, BACKEND_ROOT)


try:
  from fastapi import HTTPException
  from fastapi.testclient import TestClient
  from app import main as app_main
except Exception as exc:  # pragma: no cover
  HTTPException = None
  TestClient = None
  app_main = None
  IMPORT_ERROR = exc
else:
  IMPORT_ERROR = None


class GameplayApiIntegrationTests(unittest.TestCase):
  @classmethod
  def setUpClass(cls):
    if app_main is None:
      raise unittest.SkipTest(f"FastAPI app unavailable: {IMPORT_ERROR}")

  def setUp(self):
    self.app = app_main.app
    self.app.dependency_overrides[app_main.get_current_user] = lambda: {"user_id": 314}
    self._orig_startup = list(self.app.router.on_startup)
    self._orig_shutdown = list(self.app.router.on_shutdown)
    self.app.router.on_startup = []
    self.app.router.on_shutdown = []
    self.client = TestClient(self.app)

  def tearDown(self):
    self.client.close()
    self.app.dependency_overrides.clear()
    self.app.router.on_startup = self._orig_startup
    self.app.router.on_shutdown = self._orig_shutdown

  def test_guess_endpoint_passes_authenticated_user_and_guess_metadata(self):
    with patch.object(app_main.crud, "validate_guess", return_value={"result": ["absent"] * 5}) as mock_validate:
      response = self.client.post(
        "/api/guess",
        json={"word": "crane", "campaign_id": 7, "day": 3},
      )

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json()["result"], ["absent"] * 5)
    mock_validate.assert_called_once_with("crane", 314, 7, 3)

  def test_use_item_endpoint_passes_optional_target_and_payload(self):
    with patch.object(app_main.crud, "use_item", return_value={"ok": True}) as mock_use_item:
      response = self.client.post(
        "/api/campaign/items/use",
        json={
          "campaign_id": 5,
          "item_key": "oracle_whisper",
          "target_user_id": None,
          "effect_payload": {"value": "q"},
        },
      )

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json(), {"ok": True})
    mock_use_item.assert_called_once_with(314, 5, "oracle_whisper", None, {"value": "q"})

  def test_targets_for_item_endpoint_passes_item_key(self):
    payload = {"targets": [{"user_id": 1, "blocked": False}]}
    with patch.object(app_main.crud, "get_targetable_members_with_item_status", return_value=payload) as mock_targets:
      response = self.client.post(
        "/api/campaign/targets/item",
        json={"campaign_id": 22, "item_key": "voidbrand"},
      )

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json(), payload)
    mock_targets.assert_called_once_with(22, 314, "voidbrand")

  def test_mercy_redeem_endpoint_passes_through_crud_payload(self):
    with patch.object(app_main.crud, "redeem_candle_of_mercy", return_value={"bonus": 10}) as mock_redeem:
      response = self.client.post("/api/campaign/items/mercy/redeem", json={"campaign_id": 8})

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json(), {"bonus": 10})
    mock_redeem.assert_called_once_with(314, 8)

  def test_pending_weekly_reward_endpoint_returns_crud_payload(self):
    payload = {
      "pending": True,
      "recipient_count": 2,
      "candidates": [{"user_id": 1}, {"user_id": 2}],
    }
    with patch.object(app_main.crud, "get_weekly_reward_pending_for_user", return_value=payload) as mock_pending:
      response = self.client.post("/api/campaign/rewards/pending", json={"campaign_id": 55})

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json(), payload)
    mock_pending.assert_called_once_with(314, 55)

  def test_choose_weekly_reward_endpoint_passes_recipient_ids(self):
    with patch.object(app_main.crud, "choose_weekly_reward_recipients_for_user", return_value={"ok": True}) as mock_choose:
      response = self.client.post(
        "/api/campaign/rewards/choose",
        json={"campaign_id": 55, "recipient_user_ids": [11, 12]},
      )

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json(), {"ok": True})
    mock_choose.assert_called_once_with(314, 55, [11, 12])

  def test_choose_weekly_reward_endpoint_requires_recipient_list(self):
    response = self.client.post("/api/campaign/rewards/choose", json={"campaign_id": 55})

    self.assertEqual(response.status_code, 422)

  def test_use_item_endpoint_surfaces_http_errors(self):
    with patch.object(
      app_main.crud,
      "use_item",
      side_effect=HTTPException(status_code=400, detail="Target required"),
    ):
      response = self.client.post(
        "/api/campaign/items/use",
        json={"campaign_id": 9, "item_key": "voidbrand", "target_user_id": None, "effect_payload": None},
      )

    self.assertEqual(response.status_code, 400)
    self.assertEqual(response.json(), {"detail": "Target required"})


if __name__ == "__main__":
  unittest.main()
