# Item Key Database Migration (Postgres)

```sql
BEGIN;

-- Canonical key mapping (legacy + renamed canonical keys)
-- edict_of_compulsion      -> hex_of_compulsion
-- hex_of_forced_utterance  -> hex_of_compulsion
-- executioners_cut         -> reapers_scythe
-- cartographers_insight    -> guiding_light
-- grace_of_the_guiding_star-> guiding_light
-- god_of_the_easy_tongue   -> vowel_vision
-- dance_of_the_jester      -> earthquake
-- blood_oath_ink           -> phantoms_mirage
-- veil_of_obscured_sight   -> blinding_brew

-- 1) Merge inventory rows that would collide on PK after rename
WITH key_map(old_key, new_key) AS (
  VALUES
    ('edict_of_compulsion', 'hex_of_compulsion'),
    ('hex_of_forced_utterance', 'hex_of_compulsion'),
    ('executioners_cut', 'reapers_scythe'),
    ('cartographers_insight', 'guiding_light'),
    ('grace_of_the_guiding_star', 'guiding_light'),
    ('god_of_the_easy_tongue', 'vowel_vision'),
    ('dance_of_the_jester', 'earthquake'),
    ('blood_oath_ink', 'phantoms_mirage'),
    ('veil_of_obscured_sight', 'blinding_brew')
)
INSERT INTO campaign_user_items (user_id, campaign_id, item_key, quantity, acquired_at)
SELECT
  cui.user_id,
  cui.campaign_id,
  km.new_key,
  SUM(cui.quantity) AS quantity,
  MIN(cui.acquired_at) AS acquired_at
FROM campaign_user_items cui
JOIN key_map km ON km.old_key = cui.item_key
GROUP BY cui.user_id, cui.campaign_id, km.new_key
ON CONFLICT (user_id, campaign_id, item_key)
DO UPDATE SET
  quantity = campaign_user_items.quantity + EXCLUDED.quantity,
  acquired_at = LEAST(campaign_user_items.acquired_at, EXCLUDED.acquired_at);

DELETE FROM campaign_user_items cui
USING (
  VALUES
    ('edict_of_compulsion'),
    ('hex_of_forced_utterance'),
    ('executioners_cut'),
    ('cartographers_insight'),
    ('grace_of_the_guiding_star'),
    ('god_of_the_easy_tongue'),
    ('dance_of_the_jester'),
    ('blood_oath_ink'),
    ('veil_of_obscured_sight')
) AS old_keys(old_key)
WHERE cui.item_key = old_keys.old_key;

-- 2) Merge status effects that would collide on PK after rename
WITH key_map(old_key, new_key) AS (
  VALUES
    ('edict_of_compulsion', 'hex_of_compulsion'),
    ('hex_of_forced_utterance', 'hex_of_compulsion'),
    ('executioners_cut', 'reapers_scythe'),
    ('cartographers_insight', 'guiding_light'),
    ('grace_of_the_guiding_star', 'guiding_light'),
    ('god_of_the_easy_tongue', 'vowel_vision'),
    ('dance_of_the_jester', 'earthquake'),
    ('blood_oath_ink', 'phantoms_mirage'),
    ('veil_of_obscured_sight', 'blinding_brew')
)
INSERT INTO campaign_user_status_effects (
  user_id, campaign_id, effect_key, effect_value, applied_at, expires_at, active
)
SELECT
  s.user_id,
  s.campaign_id,
  km.new_key,
  s.effect_value,
  s.applied_at,
  s.expires_at,
  s.active
FROM campaign_user_status_effects s
JOIN key_map km ON km.old_key = s.effect_key
ON CONFLICT (user_id, campaign_id, effect_key)
DO UPDATE SET
  effect_value = COALESCE(campaign_user_status_effects.effect_value, EXCLUDED.effect_value),
  applied_at = COALESCE(
    GREATEST(campaign_user_status_effects.applied_at, EXCLUDED.applied_at),
    campaign_user_status_effects.applied_at,
    EXCLUDED.applied_at
  ),
  expires_at = COALESCE(
    GREATEST(campaign_user_status_effects.expires_at, EXCLUDED.expires_at),
    campaign_user_status_effects.expires_at,
    EXCLUDED.expires_at
  ),
  active = campaign_user_status_effects.active OR EXCLUDED.active;

DELETE FROM campaign_user_status_effects s
USING (
  VALUES
    ('edict_of_compulsion'),
    ('hex_of_forced_utterance'),
    ('executioners_cut'),
    ('cartographers_insight'),
    ('grace_of_the_guiding_star'),
    ('god_of_the_easy_tongue'),
    ('dance_of_the_jester'),
    ('blood_oath_ink'),
    ('veil_of_obscured_sight')
) AS old_keys(old_key)
WHERE s.effect_key = old_keys.old_key;

-- 3) Merge global stats keys
WITH key_map(old_key, new_key) AS (
  VALUES
    ('edict_of_compulsion', 'hex_of_compulsion'),
    ('hex_of_forced_utterance', 'hex_of_compulsion'),
    ('executioners_cut', 'reapers_scythe'),
    ('cartographers_insight', 'guiding_light'),
    ('grace_of_the_guiding_star', 'guiding_light'),
    ('god_of_the_easy_tongue', 'vowel_vision'),
    ('dance_of_the_jester', 'earthquake'),
    ('blood_oath_ink', 'phantoms_mirage'),
    ('veil_of_obscured_sight', 'blinding_brew')
)
INSERT INTO global_item_stats (item_key, uses, targets, last_used_at)
SELECT
  km.new_key,
  COALESCE(SUM(g.uses), 0),
  COALESCE(SUM(g.targets), 0),
  MAX(g.last_used_at)
FROM global_item_stats g
JOIN key_map km ON km.old_key = g.item_key
GROUP BY km.new_key
ON CONFLICT (item_key)
DO UPDATE SET
  uses = global_item_stats.uses + EXCLUDED.uses,
  targets = global_item_stats.targets + EXCLUDED.targets,
  last_used_at = COALESCE(
    GREATEST(global_item_stats.last_used_at, EXCLUDED.last_used_at),
    global_item_stats.last_used_at,
    EXCLUDED.last_used_at
  );

DELETE FROM global_item_stats
WHERE item_key IN (
  'edict_of_compulsion',
  'hex_of_forced_utterance',
  'executioners_cut',
  'cartographers_insight',
  'grace_of_the_guiding_star',
  'god_of_the_easy_tongue',
  'dance_of_the_jester',
  'blood_oath_ink',
  'veil_of_obscured_sight'
);

-- 4) Rename keys in event/log/purchase tables
UPDATE campaign_item_events
SET item_key = CASE item_key
  WHEN 'edict_of_compulsion' THEN 'hex_of_compulsion'
  WHEN 'hex_of_forced_utterance' THEN 'hex_of_compulsion'
  WHEN 'executioners_cut' THEN 'reapers_scythe'
  WHEN 'cartographers_insight' THEN 'guiding_light'
  WHEN 'grace_of_the_guiding_star' THEN 'guiding_light'
  WHEN 'god_of_the_easy_tongue' THEN 'vowel_vision'
  WHEN 'dance_of_the_jester' THEN 'earthquake'
  WHEN 'blood_oath_ink' THEN 'phantoms_mirage'
  WHEN 'veil_of_obscured_sight' THEN 'blinding_brew'
  ELSE item_key
END
WHERE item_key IN (
  'edict_of_compulsion',
  'hex_of_forced_utterance',
  'executioners_cut',
  'cartographers_insight',
  'grace_of_the_guiding_star',
  'god_of_the_easy_tongue',
  'dance_of_the_jester',
  'blood_oath_ink',
  'veil_of_obscured_sight'
);

UPDATE campaign_shop_log
SET item_key = CASE item_key
  WHEN 'edict_of_compulsion' THEN 'hex_of_compulsion'
  WHEN 'hex_of_forced_utterance' THEN 'hex_of_compulsion'
  WHEN 'executioners_cut' THEN 'reapers_scythe'
  WHEN 'cartographers_insight' THEN 'guiding_light'
  WHEN 'grace_of_the_guiding_star' THEN 'guiding_light'
  WHEN 'god_of_the_easy_tongue' THEN 'vowel_vision'
  WHEN 'dance_of_the_jester' THEN 'earthquake'
  WHEN 'blood_oath_ink' THEN 'phantoms_mirage'
  WHEN 'veil_of_obscured_sight' THEN 'blinding_brew'
  ELSE item_key
END
WHERE item_key IN (
  'edict_of_compulsion',
  'hex_of_forced_utterance',
  'executioners_cut',
  'cartographers_insight',
  'grace_of_the_guiding_star',
  'god_of_the_easy_tongue',
  'dance_of_the_jester',
  'blood_oath_ink',
  'veil_of_obscured_sight'
);

UPDATE store_purchases
SET item_key = CASE item_key
  WHEN 'edict_of_compulsion' THEN 'hex_of_compulsion'
  WHEN 'hex_of_forced_utterance' THEN 'hex_of_compulsion'
  WHEN 'executioners_cut' THEN 'reapers_scythe'
  WHEN 'cartographers_insight' THEN 'guiding_light'
  WHEN 'grace_of_the_guiding_star' THEN 'guiding_light'
  WHEN 'god_of_the_easy_tongue' THEN 'vowel_vision'
  WHEN 'dance_of_the_jester' THEN 'earthquake'
  WHEN 'blood_oath_ink' THEN 'phantoms_mirage'
  WHEN 'veil_of_obscured_sight' THEN 'blinding_brew'
  ELSE item_key
END
WHERE item_key IN (
  'edict_of_compulsion',
  'hex_of_forced_utterance',
  'executioners_cut',
  'cartographers_insight',
  'grace_of_the_guiding_star',
  'god_of_the_easy_tongue',
  'dance_of_the_jester',
  'blood_oath_ink',
  'veil_of_obscured_sight'
);

-- 5) Remove retired keys everywhere
DELETE FROM campaign_user_items          WHERE item_key = 'voidbrand';
DELETE FROM campaign_item_events         WHERE item_key = 'voidbrand';
DELETE FROM campaign_shop_log            WHERE item_key = 'voidbrand';
DELETE FROM store_purchases              WHERE item_key = 'voidbrand';
DELETE FROM global_item_stats            WHERE item_key = 'voidbrand';
DELETE FROM campaign_user_status_effects WHERE effect_key = 'voidbrand';
DELETE FROM campaign_user_items          WHERE item_key = 'seal_of_silence';
DELETE FROM campaign_item_events         WHERE item_key = 'seal_of_silence';
DELETE FROM campaign_shop_log            WHERE item_key = 'seal_of_silence';
DELETE FROM store_purchases              WHERE item_key = 'seal_of_silence';
DELETE FROM global_item_stats            WHERE item_key = 'seal_of_silence';
DELETE FROM campaign_user_status_effects WHERE effect_key = 'seal_of_silence';

-- 6) Normalize campaign_shop_rotation JSONB items
WITH remapped AS (
  SELECT
    csr.user_id,
    csr.campaign_id,
    csr.date,
    jsonb_object_agg(cat_rows.cat, cat_rows.arr) AS new_items
  FROM campaign_shop_rotation csr
  CROSS JOIN LATERAL (
    SELECT
      e.key AS cat,
      COALESCE((
        SELECT jsonb_agg(d.mapped_key ORDER BY d.first_ord)
        FROM (
          SELECT mapped_key, MIN(ord) AS first_ord
          FROM (
            SELECT
              CASE v.value
                WHEN 'edict_of_compulsion' THEN 'hex_of_compulsion'
                WHEN 'hex_of_forced_utterance' THEN 'hex_of_compulsion'
                WHEN 'executioners_cut' THEN 'reapers_scythe'
                WHEN 'cartographers_insight' THEN 'guiding_light'
                WHEN 'grace_of_the_guiding_star' THEN 'guiding_light'
                WHEN 'god_of_the_easy_tongue' THEN 'vowel_vision'
                WHEN 'dance_of_the_jester' THEN 'earthquake'
                WHEN 'blood_oath_ink' THEN 'phantoms_mirage'
                WHEN 'veil_of_obscured_sight' THEN 'blinding_brew'
                WHEN 'voidbrand' THEN NULL
                WHEN 'seal_of_silence' THEN NULL
                ELSE v.value
              END AS mapped_key,
              v.ord
            FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(e.value) = 'array' THEN e.value ELSE '[]'::jsonb END
            ) WITH ORDINALITY AS v(value, ord)
          ) m
          WHERE mapped_key IS NOT NULL
          GROUP BY mapped_key
        ) d
      ), '[]'::jsonb) AS arr
    FROM jsonb_each(
      CASE WHEN jsonb_typeof(csr.items) = 'object' THEN csr.items ELSE '{}'::jsonb END
    ) e
  ) cat_rows
  GROUP BY csr.user_id, csr.campaign_id, csr.date
)
UPDATE campaign_shop_rotation dst
SET
  items = remapped.new_items,
  updated_at = CURRENT_TIMESTAMP
FROM remapped
WHERE dst.user_id = remapped.user_id
  AND dst.campaign_id = remapped.campaign_id
  AND dst.date = remapped.date
  AND dst.items IS DISTINCT FROM remapped.new_items;

COMMIT;
```
