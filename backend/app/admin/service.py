import json
import random
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import HTTPException

from app.crud import get_db, is_admin_user, VALID_WORDS, PLAYABLE_WORDS
from app.items import ITEM_CATALOG, get_item
from app.utils.campaigns import resolve_campaign_day

def require_admin(conn, user_id: int):
    if not is_admin_user(conn, user_id):
        raise HTTPException(status_code=403, detail="Admin privileges required")

def list_admin_effects(user_id: int):
    with get_db() as conn:
        require_admin(conn, user_id)
        return [
            {
                "key": item["key"],
                "name": item["name"],
                "category": item.get("category"),
                "affects_others": bool(item.get("affects_others")),
                "requires_target": bool(item.get("requires_target")),
                "payload_type": item.get("payload_type")
            }
            for item in ITEM_CATALOG
        ]

def _admin_status_payload(conn, user_id: int, campaign_id: int, effect_key: str):
    _, _, _, target_day, target_date = resolve_campaign_day(conn, campaign_id, None)
    target_date_str = target_date.strftime("%Y-%m-%d")

    if effect_key == "oracle_whisper":
        word_row = conn.execute(
            "SELECT word FROM campaign_words WHERE campaign_id = %s AND day = %s",
            (campaign_id, target_day)
        ).fetchone()
        if not word_row:
            raise HTTPException(status_code=404, detail="No word assigned for that day")

        word = word_row[0]
        confirmed_letters = set()
        status_row = conn.execute("""
            SELECT letter_status
            FROM campaign_guess_states
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, target_date_str)).fetchone()
        if status_row and status_row[0]:
            try:
                status = json.loads(status_row[0])
                confirmed_letters = {k.upper() for k, v in status.items() if v == "correct"}
            except json.JSONDecodeError:
                confirmed_letters = set()

        positions = list(range(len(word)))
        random.shuffle(positions)
        chosen = None
        for pos in positions:
            if word[pos].upper() not in confirmed_letters:
                chosen = pos
                break
        if chosen is None:
            chosen = random.randint(0, len(word) - 1)

        position = chosen
        letter = word[position].upper()
        payload = {"day": target_day, "position": position + 1, "letter": letter}
        expires_at = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
        return payload, expires_at

    if effect_key == "cartographers_insight":
        word_row = conn.execute(
            "SELECT word FROM campaign_words WHERE campaign_id = %s AND day = %s",
            (campaign_id, target_day)
        ).fetchone()
        if not word_row:
            raise HTTPException(status_code=404, detail="No word assigned for that day")

        word = word_row[0].upper()
        used_letters = set()
        progress_row = conn.execute("""
            SELECT guesses
            FROM campaign_guess_states
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, target_date_str)).fetchone()
        if progress_row and progress_row[0]:
            try:
                guesses = json.loads(progress_row[0])
                for row in guesses:
                    for letter in row:
                        if letter:
                            used_letters.add(letter.upper())
            except json.JSONDecodeError:
                used_letters = set()

        alphabet = [chr(c) for c in range(ord("A"), ord("Z") + 1)]
        unused = [c for c in alphabet if c not in word and c not in used_letters]
        random.shuffle(unused)
        revealed = unused[:2] if len(unused) >= 2 else unused

        payload = {"day": target_day, "unused_letters": revealed}
        expires_at = target_date + timedelta(days=1)
        return payload, expires_at

    if effect_key == "candle_of_mercy":
        payload = {"bonus": 10}
        return payload, None

    return None, None

def admin_add_effect(user_id: int, campaign_id: int, effect_key: str, effect_payload: dict | None = None):
    item = get_item(effect_key)
    if not item:
        raise HTTPException(status_code=404, detail="Effect not found")

    payload_type = item.get("payload_type")
    payload_value = None
    if payload_type:
        payload_value = (effect_payload or {}).get("value")
        if payload_value is None:
            raise HTTPException(status_code=400, detail="This effect requires a selection.")
        payload_value = str(payload_value).strip().lower()
        if payload_type == "letter":
            if len(payload_value) != 1 or not payload_value.isalpha():
                raise HTTPException(status_code=400, detail="Choose a single letter.")
        elif payload_type == "word":
            if len(payload_value) != 5 or not payload_value.isalpha():
                raise HTTPException(status_code=400, detail="Choose a valid 5-letter word.")
            if effect_key == "voidbrand" and payload_value not in PLAYABLE_WORDS:
                raise HTTPException(status_code=400, detail="Word must come from the playable list.")
            if effect_key != "voidbrand" and payload_value not in VALID_WORDS:
                raise HTTPException(status_code=400, detail="Word must be a valid guess.")
        else:
            raise HTTPException(status_code=400, detail="Unsupported payload type.")

    with get_db() as conn:
        require_admin(conn, user_id)
        member_row = conn.execute("""
            SELECT 1
            FROM campaign_members
            WHERE campaign_id = %s AND user_id = %s
        """, (campaign_id, user_id)).fetchone()
        if not member_row:
            raise HTTPException(status_code=403, detail="You are not a member of this campaign")

        _, _, _, _, target_date = resolve_campaign_day(conn, campaign_id, None)
        target_date_str = target_date.strftime("%Y-%m-%d")
        today_str = datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%d")
        effective_on = today_str if item.get("affects_others") else target_date_str

        if item.get("affects_others"):
            sender_name = "Test User"
            conn.execute("""
                DELETE FROM campaign_item_events
                WHERE campaign_id = %s
                  AND target_user_id = %s
                  AND item_key = %s
                  AND event_type = %s
            """, (campaign_id, user_id, effect_key, "use"))
            details_payload = {
                "name": item["name"],
                "category": item.get("category"),
                "effective_on": effective_on,
                "delayed": False
            }
            details_payload["sender_name"] = sender_name
            if effect_key == "send_in_the_clown" and effect_payload:
                try:
                    row_value = int(effect_payload.get("row"))
                except (TypeError, ValueError):
                    raise HTTPException(status_code=400, detail="Clown row must be a number.")
                if row_value < 2 or row_value > 6:
                    raise HTTPException(status_code=400, detail="Clown row must be between 2 and 6.")
                details_payload["payload"] = {"type": "row", "value": row_value}
            if payload_type:
                details_payload["payload"] = {"type": payload_type, "value": payload_value}
            details = json.dumps(details_payload)
            conn.execute("""
                INSERT INTO campaign_item_events (user_id, campaign_id, item_key, target_user_id, event_type, details)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (user_id, campaign_id, effect_key, user_id, "use", details))
            return {"status": "applied", "effect_key": effect_key, "effect_type": "target"}

        conn.execute("""
            UPDATE campaign_user_status_effects
            SET active = FALSE
            WHERE user_id = %s AND campaign_id = %s AND effect_key = %s
        """, (user_id, campaign_id, effect_key))
        conn.execute("""
            DELETE FROM campaign_item_events
            WHERE user_id = %s
              AND campaign_id = %s
              AND item_key = %s
              AND event_type = %s
              AND DATE(created_at) = %s
        """, (user_id, campaign_id, effect_key, "use", target_date_str))

        payload, expires_at = _admin_status_payload(conn, user_id, campaign_id, effect_key)
        effect_value = json.dumps(payload) if payload is not None else None

        conn.execute("""
            INSERT INTO campaign_user_status_effects (user_id, campaign_id, effect_key, effect_value, applied_at, expires_at, active)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, %s, TRUE)
            ON CONFLICT (user_id, campaign_id, effect_key)
            DO UPDATE SET effect_value = EXCLUDED.effect_value,
                          applied_at = EXCLUDED.applied_at,
                          expires_at = EXCLUDED.expires_at,
                          active = TRUE
        """, (user_id, campaign_id, effect_key, effect_value, expires_at))

    return {"status": "applied", "effect_key": effect_key, "effect_type": "status"}

def admin_clear_effects(user_id: int, campaign_id: int):
    with get_db() as conn:
        require_admin(conn, user_id)
        conn.execute("""
            UPDATE campaign_user_status_effects
            SET active = FALSE
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id))
        conn.execute("""
            DELETE FROM campaign_item_events
            WHERE campaign_id = %s AND target_user_id = %s
        """, (campaign_id, user_id))

    return {"status": "cleared"}

def admin_reset_day(user_id: int, campaign_id: int):
    with get_db() as conn:
        require_admin(conn, user_id)
        _, _, _, _, target_date = resolve_campaign_day(conn, campaign_id, None)
        target_date_str = target_date.strftime("%Y-%m-%d")

        conn.execute("""
            DELETE FROM campaign_guesses
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, target_date_str))
        conn.execute("""
            DELETE FROM campaign_guess_states
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, target_date_str))
        conn.execute("""
            DELETE FROM campaign_daily_progress
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, target_date_str))
        conn.execute("""
            DELETE FROM campaign_user_daily_results
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, target_date_str))
        conn.execute("""
            DELETE FROM campaign_first_guesses
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, target_date_str))
        conn.execute("""
            DELETE FROM campaign_daily_troops
            WHERE user_id = %s AND campaign_id = %s AND date = %s
        """, (user_id, campaign_id, target_date_str))

    return {"status": "reset", "date": target_date_str}

def admin_add_coins(user_id: int, campaign_id: int, amount: int):
    with get_db() as conn:
        require_admin(conn, user_id)
        row = conn.execute("""
            SELECT coins
            FROM campaign_coins
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()
        current = row[0] if row else 0
        next_coins = max(0, current + amount)

        if row:
            conn.execute("""
                UPDATE campaign_coins
                SET coins = %s
                WHERE user_id = %s AND campaign_id = %s
            """, (next_coins, user_id, campaign_id))
        else:
            conn.execute("""
                INSERT INTO campaign_coins (user_id, campaign_id, coins, last_awarded_date)
                VALUES (%s, %s, %s, NULL)
            """, (user_id, campaign_id, next_coins))

    return {"coins": next_coins}

def admin_add_streak(user_id: int, campaign_id: int, amount: int):
    with get_db() as conn:
        require_admin(conn, user_id)
        row = conn.execute("""
            SELECT streak
            FROM campaign_streaks
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()
        current = row[0] if row else 0
        next_streak = max(0, current + amount)

        if row:
            conn.execute("""
                UPDATE campaign_streaks
                SET streak = %s
                WHERE user_id = %s AND campaign_id = %s
            """, (next_streak, user_id, campaign_id))
        else:
            conn.execute("""
                INSERT INTO campaign_streaks (user_id, campaign_id, streak, last_completed_date)
                VALUES (%s, %s, %s, NULL)
            """, (user_id, campaign_id, next_streak))

        stats_row = conn.execute("""
            SELECT current_streak, longest_streak
            FROM user_campaign_stats
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()
        if stats_row:
            current_streak, longest_streak = stats_row
            updated_current = max(0, current_streak + amount)
            updated_longest = max(longest_streak, updated_current)
            conn.execute("""
                UPDATE user_campaign_stats
                SET current_streak = %s,
                    longest_streak = %s
                WHERE user_id = %s AND campaign_id = %s
            """, (updated_current, updated_longest, user_id, campaign_id))
        elif amount > 0:
            conn.execute("""
                INSERT INTO user_campaign_stats (
                    user_id,
                    campaign_id,
                    current_streak,
                    longest_streak
                ) VALUES (%s, %s, %s, %s)
            """, (user_id, campaign_id, next_streak, next_streak))

    return {"streak": next_streak}

def admin_reset_double_down(user_id: int, campaign_id: int):
    with get_db() as conn:
        require_admin(conn, user_id)
        conn.execute("""
            UPDATE campaign_members
            SET double_down_used_week = 0,
                double_down_activated = 0,
                double_down_date = NULL
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id))

    return {"status": "reset"}
