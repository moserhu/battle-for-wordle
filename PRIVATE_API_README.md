# Battle for Wordle Private API (Stats)

This private API is protected by a single shared key and is intended for your internal tools/UI.

## Auth (recommended: backend proxy)
- The UI should NOT send `X-API-Key`.
- Your system backend should proxy `/api/bfw/*` to the BfW backend and inject the `X-API-Key` from server env.
- Configure these on the system backend:
  - `BFW_API_BASE=http://100.104.46.98:8002/api/private`
  - `PRIVATE_API_KEY=...`
  
If you are not using a proxy, you can send the header directly:
- Header: `X-API-Key: <PRIVATE_API_KEY>`

## Base URL
If proxied:
- UI base path: `/api/bfw`

Direct (no proxy):
- Base: `http://localhost:8000`
- All endpoints below are under `/api/private/...`

## Quick Test (direct)
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  http://localhost:8000/api/private/ping
```

## Campaign List (no user info)
Proxied (UI):
```bash
curl http://localhost:3000/api/bfw/campaigns
```

Direct:
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

## Campaign Details (includes invite code)
Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/campaign/details?campaign_id=12"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/campaign/details?campaign_id=12"
```

## Users (non-PII)
Returns non-sensitive user fields (no email/phone/password).

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/users?limit=100&offset=0"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/users?limit=100&offset=0"
```

## Campaign Members (no personal info)
Returns campaign membership display info (no names/email/phone).
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/campaign/members?campaign_id=12"
```
Response fields include:
- `user_id`
- `display_name`
- `color`
- `score`
- `coins`
- `army_name`
- `army_image_url`
- `army_image_thumb_url`
- `army_image_key`
- `army_image_thumb_key`
- `is_owner`

## Global Stats
### Daily global stats
Query params: `date_from`, `date_to` (YYYY-MM-DD), `limit`

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/stats/global/daily?limit=30"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/daily?limit=30"
```

### Global word stats
Query params: `limit`, `order_by` (`attempts|solves|fails|last_seen`)

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/stats/global/words?order_by=attempts&limit=50"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/words?order_by=attempts&limit=50"
```

### Global item stats
Query params: `limit`, `order_by` (`uses|targets|last_used_at`)

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/stats/global/items"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/items"
```

### Global accolade stats
Query params: `limit`

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/stats/global/accolades"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/accolades"
```

### Global summary (all-in-one)
Query params: `daily_limit`, `word_limit`, `item_limit`, `accolade_limit`

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/stats/global/summary?daily_limit=14&word_limit=20"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/summary?daily_limit=14&word_limit=20"
```

### Global high scores
Query params: `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/high-scores"
```

### Global streak stats
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/streaks"
```

### Global user streaks
Query params: `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/global/user-streaks?limit=50"
```

## Per-Campaign Stats
All campaign endpoints require `campaign_id`.

### Daily campaign stats
Query params: `campaign_id`, `date_from`, `date_to`, `limit`

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/stats/campaign/daily?campaign_id=12&limit=14"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/daily?campaign_id=12&limit=14"
```

### Daily campaign troops (per user)
Query params: `campaign_id`, `user_id` (optional), `date_from`, `date_to`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/daily-troops?campaign_id=12&limit=100"
```

### Campaign word stats
Query params: `campaign_id`, `date_from`, `date_to`, `limit`,
`order_by` (`solved_count|failed_count|date`)

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/stats/campaign/words?campaign_id=12"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/words?campaign_id=12"
```

### Campaign accolade stats
Query params: `campaign_id`, `limit`

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/stats/campaign/accolades?campaign_id=12"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/accolades?campaign_id=12"
```

### Campaign item usage
Query params: `campaign_id`, `limit`

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/stats/campaign/items?campaign_id=12"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/items?campaign_id=12"
```

### Campaign recaps
Query params: `campaign_id`, `date_from`, `date_to`, `limit`

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/stats/campaign/recaps?campaign_id=12&limit=7"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/recaps?campaign_id=12&limit=7"
```

### Campaign summary (all-in-one)
Query params: `campaign_id`, `daily_limit`, `word_limit`, `item_limit`, `accolade_limit`, `recap_limit`

Proxied (UI):
```bash
curl "http://localhost:3000/api/bfw/stats/campaign/summary?campaign_id=12"
```

Direct:
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/stats/campaign/summary?campaign_id=12"
```

## Users: stats & history (non-PII)
### User campaign stats
Query params: `user_id` (optional), `campaign_id` (optional), `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/users/stats?campaign_id=12"
```

### User daily results
Query params: `user_id` (optional), `campaign_id` (optional), `date_from`, `date_to`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/users/daily-results?campaign_id=12&limit=100"
```

### User accolade stats
Query params: `user_id` (optional), `campaign_id` (optional), `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/users/accolades?campaign_id=12"
```

### User accolade events
Query params: `user_id` (optional), `campaign_id` (optional), `date_from`, `date_to`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/users/accolades/events?campaign_id=12&limit=100"
```

## Campaign gameplay history
### Guess states
Query params: `campaign_id`, `user_id` (optional), `date_from`, `date_to`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/campaign/guess-states?campaign_id=12&limit=50"
```

### First guesses
Query params: `campaign_id`, `user_id` (optional), `date_from`, `date_to`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/campaign/first-guesses?campaign_id=12&limit=100"
```

## Shop
### Shop rotation
Query params: `campaign_id`, `user_id` (optional), `date_from`, `date_to`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/campaign/shop/rotation?campaign_id=12&limit=50"
```

### Shop log
Query params: `campaign_id`, `user_id` (optional), `event_type` (optional), `date_from`, `date_to`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/campaign/shop/log?campaign_id=12&limit=100"
```

### Item events
Query params: `campaign_id`, `user_id` (optional), `target_user_id` (optional),
`event_type` (optional), `item_key` (optional), `date_from`, `date_to`, `limit`
```bash
curl -H "X-API-Key: YOUR_PRIVATE_API_KEY" \
  "http://localhost:8000/api/private/campaign/item-events?campaign_id=12&limit=100"
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
Proxied (UI):
```bash
curl -H "Content-Type: application/json" \
  -d '{"campaign_id":12,"user_id":5,"coins_delta":25,"dry_run":true}' \
  http://localhost:3000/api/bfw/campaign/adjust-balances
```

Direct:
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
