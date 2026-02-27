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


class CoreApiRoutesIntegrationTests(unittest.TestCase):
  @classmethod
  def setUpClass(cls):
    if app_main is None:
      raise unittest.SkipTest(f"FastAPI app unavailable: {IMPORT_ERROR}")

  def setUp(self):
    self.app = app_main.app
    self.app.dependency_overrides[app_main.get_current_user] = lambda: {"user_id": 77}
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

  def test_login_endpoint_returns_access_token_and_user(self):
    with patch.object(app_main.crud, "login_user", return_value={"user_id": 9, "email": "a@test.com"}) as mock_login, \
         patch.object(app_main, "create_access_token", return_value="jwt-token") as mock_create_token:
      response = self.client.post("/api/login", json={"email": "a@test.com", "password": "pw"})

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json()["access_token"], "jwt-token")
    self.assertEqual(response.json()["user"]["user_id"], 9)
    mock_login.assert_called_once_with("a@test.com", "pw")
    mock_create_token.assert_called_once_with({"user_id": 9})

  def test_register_endpoint_passes_user_fields_to_crud(self):
    with patch.object(app_main.crud, "register_user", return_value={"user_id": 10}) as mock_register:
      response = self.client.post("/api/register", json={
        "first_name": "A", "last_name": "B", "email": "x@test.com", "phone": "555", "password": "pw"
      })

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json(), {"user_id": 10})
    mock_register.assert_called_once()

  def test_user_info_and_update_endpoints_use_authenticated_user(self):
    with patch.object(app_main.crud, "get_user_info", return_value={"user_id": 77, "email": "me@test.com"}) as mock_info:
      info_res = self.client.get("/api/user/info")
    self.assertEqual(info_res.status_code, 200)
    self.assertEqual(info_res.json()["user_id"], 77)
    mock_info.assert_called_once_with(77)

    with patch.object(app_main.crud, "update_user_info", return_value={"ok": True}) as mock_update:
      update_res = self.client.post("/api/user/update", json={
        "user_id": 999, "first_name": "N", "last_name": "M", "phone": "5550000000"
      })
    self.assertEqual(update_res.status_code, 200)
    mock_update.assert_called_once_with(77, "N", "M", "5550000000")

  def test_campaign_create_and_join_routes_pass_current_user(self):
    with patch.object(app_main.crud, "create_campaign", return_value={"campaign_id": 5}) as mock_create:
      res_create = self.client.post("/api/campaign/create", json={
        "name": "Realm", "cycle_length": 7, "is_admin_campaign": True
      })
    self.assertEqual(res_create.status_code, 200)
    mock_create.assert_called_once_with("Realm", 77, 7, True)

    with patch.object(app_main.crud, "join_campaign", return_value={"campaign_id": 5}) as mock_join:
      res_join = self.client.post("/api/campaign/join", json={"invite_code": "ABC123"})
    self.assertEqual(res_join.status_code, 200)
    mock_join.assert_called_once_with("ABC123", 77)

    with patch.object(app_main.crud, "join_campaign_by_id", return_value={"campaign_id": 5}) as mock_join_id:
      res_join_id = self.client.post("/api/campaign/join_by_id", json={"campaign_id": 5})
    self.assertEqual(res_join_id.status_code, 200)
    mock_join_id.assert_called_once_with(5, 77)

  def test_campaign_progress_and_game_state_routes_forward_payload(self):
    with patch.object(app_main.crud, "get_campaign_progress", return_value={"day": 2, "total": 7}) as mock_progress:
      res_progress = self.client.post("/api/campaign/progress", json={"campaign_id": 3})
    self.assertEqual(res_progress.status_code, 200)
    mock_progress.assert_called_once_with(3)

    with patch.object(app_main.crud, "get_saved_progress", return_value={"current_row": 0}) as mock_state:
      res_state = self.client.post("/api/game/state", json={"campaign_id": 3, "day": 2})
    self.assertEqual(res_state.status_code, 200)
    mock_state.assert_called_once_with(77, 3, 2)

  def test_campaign_member_and_leaderboard_routes_use_authenticated_user(self):
    with patch.object(app_main.crud, "get_campaign_members", return_value=[]) as mock_members:
      res_members = self.client.post("/api/campaign/members", json={"campaign_id": 3})
    self.assertEqual(res_members.status_code, 200)
    mock_members.assert_called_once_with(3, 77)

    with patch.object(app_main.crud, "get_self_member", return_value={"user_id": 77}) as mock_self:
      res_self = self.client.post("/api/campaign/self_member", json={"campaign_id": 3})
    self.assertEqual(res_self.status_code, 200)
    mock_self.assert_called_once_with(3, 77)

    with patch.object(app_main.crud, "get_leaderboard", return_value=[]) as mock_lb:
      res_lb = self.client.post("/api/leaderboard", json={"campaign_id": 3})
    self.assertEqual(res_lb.status_code, 200)
    mock_lb.assert_called_once_with(3)

  def test_campaign_maintenance_routes_pass_through(self):
    with patch.object(app_main.crud, "update_campaign_name", return_value={"ok": True}) as mock_name:
      res_name = self.client.post("/api/campaign/update_name", json={"campaign_id": 3, "name": "New"})
    self.assertEqual(res_name.status_code, 200)
    mock_name.assert_called_once_with(3, 77, "New")

    with patch.object(app_main.crud, "delete_campaign", return_value={"ok": True}) as mock_delete:
      res_delete = self.client.post("/api/campaign/delete", json={"campaign_id": 3})
    self.assertEqual(res_delete.status_code, 200)
    mock_delete.assert_called_once_with(3, 77)

    with patch.object(app_main.crud, "kick_player_from_campaign", return_value={"ok": True}) as mock_kick:
      res_kick = self.client.post("/api/campaign/kick", json={"campaign_id": 3, "user_id": 99})
    self.assertEqual(res_kick.status_code, 200)
    mock_kick.assert_called_once_with(3, 99, 77)

  def test_campaign_status_routes_and_double_down_forward_user(self):
    with patch.object(app_main.crud, "has_campaign_finished_for_day", return_value=True) as mock_finished:
      res_finished = self.client.post("/api/campaign/finished_today", json={"campaign_id": 3})
    self.assertEqual(res_finished.status_code, 200)
    self.assertEqual(res_finished.json(), {"ended": True})
    mock_finished.assert_called_once_with(3)

    with patch.object(app_main.crud, "activate_double_down", return_value={"ok": True}) as mock_dd:
      res_dd = self.client.post("/api/double_down", json={"campaign_id": 3})
    self.assertEqual(res_dd.status_code, 200)
    mock_dd.assert_called_once_with(77, 3)

  def test_global_leaderboard_and_acknowledge_update_require_auth_user(self):
    with patch.object(app_main.crud, "get_global_leaderboard", return_value=[{"user_id": 1}]) as mock_glb:
      res_glb = self.client.get("/api/leaderboard/global?limit=5")
    self.assertEqual(res_glb.status_code, 200)
    mock_glb.assert_called_once_with(5)

    with patch.object(app_main.crud, "acknowledge_update", return_value={"ok": True}) as mock_ack:
      res_ack = self.client.post("/api/user/acknowledge_update")
    self.assertEqual(res_ack.status_code, 200)
    mock_ack.assert_called_once_with(77)

  def test_route_surfaces_http_exception_from_crud(self):
    with patch.object(app_main.crud, "delete_campaign", side_effect=HTTPException(status_code=403, detail="Forbidden")):
      res = self.client.post("/api/campaign/delete", json={"campaign_id": 3})
    self.assertEqual(res.status_code, 403)
    self.assertEqual(res.json(), {"detail": "Forbidden"})

  def test_campaign_create_rejects_name_over_32_chars(self):
    too_long_name = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567"
    self.assertGreater(len(too_long_name), 32)
    with patch.object(app_main.crud, "create_campaign") as mock_create:
      res = self.client.post("/api/campaign/create", json={
        "name": too_long_name, "cycle_length": 7, "is_admin_campaign": False
      })
    self.assertEqual(res.status_code, 422)
    mock_create.assert_not_called()

  def test_campaign_update_name_rejects_name_over_32_chars(self):
    too_long_name = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567"
    self.assertGreater(len(too_long_name), 32)
    with patch.object(app_main.crud, "update_campaign_name") as mock_update:
      res = self.client.post("/api/campaign/update_name", json={
        "campaign_id": 3, "name": too_long_name
      })
    self.assertEqual(res.status_code, 422)
    mock_update.assert_not_called()


if __name__ == "__main__":
  unittest.main()
