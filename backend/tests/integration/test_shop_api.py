import os
import sys
import unittest
from unittest.mock import patch


BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if BACKEND_ROOT not in sys.path:
  sys.path.insert(0, BACKEND_ROOT)


try:
  from fastapi.testclient import TestClient
  from fastapi import HTTPException
  from app import main as app_main
except Exception as exc:  # pragma: no cover
  TestClient = None
  HTTPException = None
  app_main = None
  IMPORT_ERROR = exc
else:
  IMPORT_ERROR = None


class ShopApiIntegrationTests(unittest.TestCase):
  @classmethod
  def setUpClass(cls):
    if app_main is None:
      raise unittest.SkipTest(f"FastAPI app unavailable: {IMPORT_ERROR}")

  def setUp(self):
    self.app = app_main.app
    self.app.dependency_overrides[app_main.get_current_user] = lambda: {"user_id": 99}
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

  def test_shop_state_endpoint_returns_crud_payload(self):
    payload = {"coins": 10, "items_by_category": {"illusion": [], "blessing": [], "curse": []}}
    with patch.object(app_main.crud, "get_shop_state", return_value=payload) as mock_get_shop_state:
      response = self.client.post("/api/campaign/shop/state", json={"campaign_id": 7, "day": 1})

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json(), payload)
    mock_get_shop_state.assert_called_once_with(99, 7)

  def test_purchase_endpoint_passes_through_arguments(self):
    payload = {"coins": 6, "item": {"key": "candle_of_mercy"}, "quantity": 1}
    with patch.object(app_main.crud, "purchase_item", return_value=payload) as mock_purchase:
      response = self.client.post(
        "/api/campaign/shop/purchase",
        json={"campaign_id": 7, "item_key": "candle_of_mercy"},
      )

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json()["coins"], 6)
    mock_purchase.assert_called_once_with(99, 7, "candle_of_mercy")

  def test_reshuffle_endpoint_passes_category_and_returns_payload(self):
    payload = {"coins": 7, "items_by_category": {"illusion": [], "blessing": [], "curse": []}}
    with patch.object(app_main.crud, "reshuffle_shop", return_value=payload) as mock_reshuffle:
      response = self.client.post(
        "/api/campaign/shop/reshuffle",
        json={"campaign_id": 7, "category": "illusion"},
      )

    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.json(), payload)
    mock_reshuffle.assert_called_once_with(99, 7, "illusion")

  def test_purchase_endpoint_surfaces_http_errors(self):
    with patch.object(
      app_main.crud,
      "purchase_item",
      side_effect=HTTPException(status_code=400, detail="Not enough coins"),
    ):
      response = self.client.post(
        "/api/campaign/shop/purchase",
        json={"campaign_id": 7, "item_key": "voidbrand"},
      )

    self.assertEqual(response.status_code, 400)
    self.assertEqual(response.json(), {"detail": "Not enough coins"})


if __name__ == "__main__":
  unittest.main()
