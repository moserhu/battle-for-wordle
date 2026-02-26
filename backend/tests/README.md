# Backend Tests

Organized backend test area.

Suggested layout:
- `unit/` pure logic tests (no DB/network)
- `integration/` API + DB tests (app wiring, auth, database fixtures)

Current suite starts with shop rotation helper coverage in:
- `backend/tests/unit/test_shop_rotation.py`

Run backend unit tests (standard library `unittest`):

```bash
python3 -m unittest discover -s backend/tests -p 'test_*.py'
```

Note:
- In this environment, backend tests may be skipped if backend runtime deps (e.g. `fastapi`, `psycopg`) are not installed.
