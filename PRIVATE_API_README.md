# Battle for Wordle Private API (Stats)

This private API is protected by a single shared key and is intended for your internal tools/UI.

## Auth
- Header: `X-API-Key: <PRIVATE_API_KEY>`
- Configure `PRIVATE_API_KEY` in the backend environment.

## Base URL
- Local dev (default): `http://localhost:8000`
- All endpoints below are under `/api/private/...`

## Quick Test
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  http://localhost:8000/api/private/ping
```

## Campaign List (no user info)
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  http://localhost:8000/api/private/campaigns
```
Response:
```json
{
  "campaigns": [
    {
      "campaign_id": 12,
      "name": "Winter League",
      "start_date": "2025-12-01",
      "cycle_length": 7,
      "is_admin_campaign": false,
      "member_count": 8
    }
  ]
}
```

## Campaign Members (no personal info)
Returns campaign membership display info (no names/email/phone).
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/campaign/members?campaign_id=12"
```

## Global Stats
### Daily global stats
Query params: `date_from`, `date_to` (YYYY-MM-DD), `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/daily?limit=30"
```

### Global word stats
Query params: `limit`, `order_by` (`attempts|solves|fails|last_seen`)
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/words?order_by=attempts&limit=50"
```

### Global item stats
Query params: `limit`, `order_by` (`uses|targets|last_used_at`)
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/items"
```

### Global accolade stats
Query params: `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/accolades"
```

### Global summary (all-in-one)
Query params: `daily_limit`, `word_limit`, `item_limit`, `accolade_limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/summary?daily_limit=14&word_limit=20"
```

## Per-Campaign Stats
All campaign endpoints require `campaign_id`.

### Daily campaign stats
Query params: `campaign_id`, `date_from`, `date_to`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/daily?campaign_id=12&limit=14"
```

### Campaign word stats
Query params: `campaign_id`, `date_from`, `date_to`, `limit`,
`order_by` (`solved_count|failed_count|date`)
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/words?campaign_id=12"
```

### Campaign accolade stats
Query params: `campaign_id`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/accolades?campaign_id=12"
```

### Campaign item usage
Query params: `campaign_id`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/items?campaign_id=12"
```

### Campaign recaps
Query params: `campaign_id`, `date_from`, `date_to`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/recaps?campaign_id=12&limit=7"
```

### Campaign summary (all-in-one)
Query params: `campaign_id`, `daily_limit`, `word_limit`, `item_limit`, `accolade_limit`, `recap_limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/summary?campaign_id=12"
```

## Adjust coins / score (per user + campaign)
Endpoint: `POST /api/private/campaign/adjust-balances`

Body fields:
- `campaign_id` (int, required)
- `user_id` (int, required)
- `coins_delta` (int, optional) or `coins_set` (int, optional)
- `score_delta` (int, optional) or `score_set` (int, optional)
- `dry_run` (bool, optional, default false)

Examples:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"campaign_id":12,"user_id":5,"coins_delta":25,"dry_run":true}' \
  http://localhost:8000/api/private/campaign/adjust-balances
```

```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"campaign_id":12,"user_id":5,"score_set":120}' \
  http://localhost:8000/api/private/campaign/adjust-balances
```

## Notes for UI integration
- Every request must include the `X-API-Key` header.
- These endpoints intentionally exclude per-user detail.
- All dates are `YYYY-MM-DD` strings.
- Mutations are audit-logged server-side.
- For charts, the daily endpoints are already sorted with newest first.
