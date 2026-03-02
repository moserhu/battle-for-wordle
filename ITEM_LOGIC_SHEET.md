# Battle for Wordle Item Logic Sheet (Current Code)

This sheet reflects what the code currently does for items in `backend/app/items/*`, `backend/app/crud.py`, and the active game UI.

## Global Item Rules (Currently Enforced)

- Shop rotates by category (`illusion`, `blessing`, `curse`) with 2 items per category in daily rotation.
- Purchase guard: item must be in today's rotated slot for its category.
- Use guard: player must own quantity > 0.
- Use guard: targeted items cannot be used on final campaign day.
- Use guard: targeted items require a valid target campaign member.
- For targeted effects, event is queued with `details.effective_on = next day` and applied when target plays that day.
- `exclusive_all` effects: only one such queued targeted effect per target per day.
- `exclusive_with` effects: additional pairwise conflict checks (e.g., `cone_of_cold` vs `spider_swarm`).
- Legacy keys are aliased:
  - `edict_of_compulsion` -> `hex_of_forced_utterance`
  - `executioners_cut` -> `reapers_scythe`
  - `cartographers_insight` -> `grace_of_the_guiding_star`
  - `dance_of_the_jester` -> `earthquake`
  - `blood_oath_ink` -> `phantoms_mirage`

## Payload Rules (Currently Enforced)

- `payload_type: letter` -> exactly 1 alpha letter.
- `payload_type: word` -> exactly 5 alpha letters.
- `hex_of_forced_utterance`: word must contain at least 4 unique letters.
- `payload_type: word` items: value must be in valid-guess dictionary.

## Runtime Effect Application Path

- Targeted item effects are read from `campaign_item_events` for `effective_on = today` via `/api/campaign/items/active`.
- Status effects are read from `campaign_user_status_effects` via `/api/campaign/items/status`.
- Guess-time enforcement happens in `validate_guess`.

---

## Blessings

### `candle_of_mercy`
- Category: blessing
- Cost: 8
- Handler: implemented
- Behavior:
  - Adds status effect `candle_of_mercy` with `bonus_troops_on_fail = 10`.
  - On failure modal, player can redeem once/day for +10 troops.
- Frontend support: yes (banner + redeem flow in game screen).

### `grace_of_the_guiding_star`
- Category: blessing
- Cost: 8
- Handler: implemented
- Behavior:
  - Computes 4 letters not in answer and not already used by player.
  - Stores daily status payload `{ day, unused_letters[] }` expiring next day.
  - UI marks those letters absent/gray and disables via keyboard state.
- Frontend support: yes.
- Note: admin tool helper currently reveals 2 letters (not 4), normal item use reveals 4.

### `oracle_whisper`
- Category: blessing
- Cost: 12
- Handler: implemented
- Behavior:
  - Once per day.
  - Blocked if Double Down is active.
  - Reveals one guaranteed correct letter + exact position.
  - Stored in status effect for current day; expires next day.
- Frontend support: yes (hint banner + auto-placement helper).

### `dispel_curse`
- Category: blessing
- Cost: 8
- Handler: implemented
- Behavior:
  - Sets status effect `cursed` to inactive for the current day.
- Frontend support: no dedicated UX yet.
- Runtime rule interaction:
  - Blessings are blocked while curse effects are active for today unless this marker is present.

### `twin_fates`
- Category: blessing
- Cost: 8
- Handler: implemented
- Behavior:
  - Reads today's answer and stores duplicated-letter placements in status payload:
    `{ day, letters: [{ letter, positions[] }] }`
- Frontend support: yes (status banner with duplicated letters and positions).

### `god_of_the_easy_tongue`
- Category: blessing
- Cost: 4
- Handler: implemented
- Behavior:
  - Counts vowels in today's answer.
  - Stores status payload `{ day, vowel_count }` expiring next day.
- Frontend support: yes (status banner with vowel count).

---

## Curses

### `hex_of_forced_utterance`
- Category: curse
- Cost: 16
- Targeted: yes
- Payload: `word`
- Exclusive: `exclusive_all`
- Behavior:
  - Target's first guess must equal forced word.
  - UI auto-fills/auto-submits first row flow when active.
- Frontend support: yes.

### `reapers_scythe`
- Category: curse
- Cost: 8
- Targeted: yes
- Exclusive: `exclusive_all`
- Behavior:
  - Reduces max visible guess rows from 6 to 5 (bottom row removed).
- Frontend support: yes.

### `seal_of_silence` (retired from shop)
- Category: curse
- Cost: 6
- Targeted: yes
- Payload: `letter`
- Exclusive: `exclusive_all`
- Behavior:
  - Chosen letter cannot be used on target's first two guesses.
- Frontend support: yes.

### `vowel_voodoo`
- Category: curse
- Cost: 12
- Targeted: yes
- Exclusive: `exclusive_all`
- Behavior:
  - Payload stores two vowels (from provided value or randomized).
  - Those vowels are blocked on first two guesses.
- Frontend support: yes (inventory modal payload picker + blocked key handling).

### `veil_of_obscured_sight`
- Category: curse
- Cost: 12
- Targeted: yes
- Exclusive: `exclusive_all`
- Behavior:
  - Payload stores side (`left`/`right`, randomized if not provided).
  - For first two guesses, result feedback in masked columns returns as hidden.
- Frontend support: yes (inventory side picker + hidden-tile rendering).

### `consonant_cleaver`
- Category: curse
- Cost: 12
- Targeted: yes
- Exclusive: `exclusive_all`
- Behavior:
  - Randomizes and stores four blocked consonants.
  - Blocked consonants are rejected while effect is active.
- Frontend support: yes (blocked key handling when payload is active).

### `infernal_mandate`
- Category: curse
- Cost: 12
- Targeted: yes
- Exclusive: `exclusive_all`
- Behavior:
  - Invalid dictionary guesses incur -5 troops (cap 20/day).
  - Breaking hard-mode constraints (must keep revealed greens and include revealed yellows) incurs -5 troops (cap 20/day).
  - Penalties tracked in status payload under `infernal_mandate`.
- Frontend support: partial (server-enforced; no dedicated penalty banner yet).

---

## Illusions

### `send_in_the_clown`
- Category: illusion
- Cost: 1
- Targeted: yes
- Behavior:
  - If active and no stored status, server chooses row 2..6 (or uses admin-provided row payload).
  - Stores status `send_in_the_clown { day, row }`.
  - Guess at matching row triggers clown overlay and status is deactivated.
- Frontend support: yes (overlay + audio).
- Gap:
  - Standard user flow does not currently expose row payload input; defaults to random row behavior.

### `earthquake`
- Category: illusion
- Cost: 2
- Targeted: yes
- Behavior:
  - Active effect triggers jester/earthquake tile motion styles.
- Frontend support: yes.

### `cone_of_cold`
- Category: illusion
- Cost: 2
- Targeted: yes
- Exclusive with: `spider_swarm`
- Behavior:
  - Frontend overlay fades by turns left; countdown decremented per submitted guess.
- Frontend support: yes.

### `phantoms_mirage`
- Category: illusion
- Cost: 1
- Targeted: yes
- Behavior:
  - Correct letters are rendered red instead of green.
- Frontend support: yes.

### `spider_swarm`
- Category: illusion
- Cost: 1
- Targeted: yes
- Exclusive with: `cone_of_cold`
- Behavior:
  - Animated spider swarm overlay while effect is active.
- Frontend support: yes.

### `sigil_of_the_wandering_glyph`
- Category: illusion
- Cost: 1
- Targeted: yes
- Behavior intent (description): bouncing rune/logo.
- Current implementation: metadata + stub handler only (no backend gameplay mutation needed).
- Frontend support: yes (DVD-style bouncing glyph overlay with placeholder icon while active).

### `time_stop`
- Category: illusion
- Cost: 2
- Targeted: yes
- Behavior intent (description): slower reveal timing.
- Current implementation: metadata + stub handler only (no backend gameplay mutation needed).
- Frontend support: yes (active effect delays result reveal / row advance by ~1.2s and shows status banner).

---

## Immediate Gaps To Implement (Priority)

1. Curse state lifecycle:
- Optional UX: expose explicit cursed status/pill in status effects endpoint.
- Optional UX: show blessing lock in inventory screen before use attempt.

2. Spreadsheet-era curses with no logic:
- Completed backend pass; payload-specific item controls now in place for active curse set.

3. Unrendered blessings/illusions:
- `twin_fates`, `god_of_the_easy_tongue`, `sigil_of_the_wandering_glyph`, `time_stop`.
