import os
import sys
import unittest
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


class ShopRotationHelpersTests(unittest.TestCase):
  def setUp(self):
    if crud is None:
      self.skipTest(f"backend app.crud import unavailable: {IMPORT_ERROR}")

  def test_select_shop_items_by_category_limits_count_and_ignores_unknowns(self):
    catalog = [
      {"key": "i1", "category": "illusion"},
      {"key": "i2", "category": "illusion"},
      {"key": "i3", "category": "illusion"},
      {"key": "b1", "category": "blessing"},
      {"key": "c1", "category": "curse"},
      {"key": "x1", "category": "unknown"},
      {"category": "curse"},
    ]

    with patch.object(crud.random, "sample", side_effect=lambda seq, n: list(seq)[:n]):
      result = crud._select_shop_items_by_category(catalog, count_per=2)

    self.assertEqual(result["illusion"], ["i1", "i2"])
    self.assertEqual(result["blessing"], ["b1"])
    self.assertEqual(result["curse"], ["c1"])
    self.assertSetEqual(set(result.keys()), {"illusion", "blessing", "curse"})

  def test_normalize_shop_rotation_dedupes_and_fills_missing_slots(self):
    catalog = [
      {"key": "i1", "category": "illusion"},
      {"key": "i2", "category": "illusion"},
      {"key": "i3", "category": "illusion"},
      {"key": "b1", "category": "blessing"},
      {"key": "b2", "category": "blessing"},
      {"key": "c1", "category": "curse"},
      {"key": "c2", "category": "curse"},
    ]
    raw = {
      "illusion": ["i1", "i1", "bad-key"],
      "blessing": ["b1"],
      "curse": [],
    }

    with patch.object(crud, "_select_shop_items_by_category", return_value={
      "illusion": ["i2", "i3"],
      "blessing": ["b2", "b1"],
      "curse": ["c1", "c2"],
    }):
      result = crud._normalize_shop_rotation(raw, catalog, count_per=2)

    self.assertEqual(result["illusion"], ["i1", "i2"])
    self.assertEqual(result["blessing"], ["b1", "b2"])
    self.assertEqual(result["curse"], ["c1", "c2"])

  def test_normalize_shop_rotation_accepts_legacy_flat_list(self):
    catalog = [
      {"key": "i1", "category": "illusion"},
      {"key": "i2", "category": "illusion"},
      {"key": "b1", "category": "blessing"},
      {"key": "b2", "category": "blessing"},
      {"key": "c1", "category": "curse"},
      {"key": "c2", "category": "curse"},
    ]
    raw = ["i1", "b1", "c1", "i2", "unknown", "b2"]

    with patch.object(crud, "_select_shop_items_by_category", return_value={
      "illusion": ["i2"],
      "blessing": ["b2"],
      "curse": ["c2"],
    }):
      result = crud._normalize_shop_rotation(raw, catalog, count_per=2)

    self.assertEqual(result["illusion"], ["i1", "i2"])
    self.assertEqual(result["blessing"], ["b1", "b2"])
    self.assertEqual(result["curse"], ["c1", "c2"])

  def test_reshuffle_shop_rejects_invalid_category_before_db_access(self):
    with self.assertRaises(Exception) as ctx:
      crud.reshuffle_shop(user_id=1, campaign_id=1, category="not-a-category")
    self.assertEqual(getattr(ctx.exception, "status_code", None), 400)
    self.assertIn("Invalid market category", getattr(ctx.exception, "detail", str(ctx.exception)))


if __name__ == "__main__":
  unittest.main()
