import json
import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.crud import get_db
from app.items import get_item
from app.media.storage import create_presigned_download
from app.accolades.service import award_accolade
from fastapi import HTTPException


def _resolve_name(display_name: str | None, first_name: str | None, last_name: str | None, user_id: int) -> str:
    if display_name:
        return display_name
    full = f"{first_name or ''} {last_name or ''}".strip()
    return full or f"Player {user_id}"


def _yesterday_ct() -> date:
    now_ct = datetime.now(ZoneInfo("America/Chicago"))
    return (now_ct - timedelta(days=1)).date()


def _parse_date(value) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(value).date()
    except Exception:
        return datetime.strptime(value, "%Y-%m-%d").date()


def _get_day_for_date(start_date: date, target_date: date) -> int:
    delta = (target_date - start_date).days
    return max(1, delta + 1)


def _get_date_for_day(start_date: date, day: int) -> date:
    return start_date + timedelta(days=max(day, 1) - 1)


def _get_campaign_start(conn, campaign_id: int):
    row = conn.execute(
        "SELECT start_date, cycle_length, COALESCE(is_admin_campaign, FALSE) FROM campaigns WHERE id = %s",
        (campaign_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    start_date_value, cycle_length, is_admin_campaign = row
    return _parse_date(start_date_value), int(cycle_length or 0), bool(is_admin_campaign)


def _build_recap_for_date(conn, campaign_id: int, target_date: date):
    date_str = target_date.strftime("%Y-%m-%d")

    result_rows = conn.execute(
        """
        SELECT
            r.user_id,
            r.guesses_used,
            r.solved,
            r.troops_earned,
            r.used_double_down,
            r.double_down_success,
            cm.display_name,
            u.first_name,
            u.last_name,
            u.profile_image_url,
            u.profile_image_key,
            u.profile_image_thumb_url,
            u.profile_image_thumb_key
        FROM campaign_user_daily_results r
        JOIN campaign_members cm ON cm.user_id = r.user_id AND cm.campaign_id = r.campaign_id
        JOIN users u ON u.id = r.user_id
        WHERE r.campaign_id = %s AND r.date = %s
        ORDER BY r.completed_at NULLS LAST, r.user_id
        """,
        (campaign_id, date_str),
    ).fetchall()

    events: list[dict] = []
    solved_count = 0
    failed_count = 0
    biggest_gain = None

    for (user_id, guesses_used, solved, troops_earned, used_dd, dd_success,
         display_name, first_name, last_name, profile_url, profile_key, profile_thumb_url, profile_thumb_key) in result_rows:
        name = _resolve_name(display_name, first_name, last_name, user_id)
        guesses_used = int(guesses_used or 0)
        troops_earned = int(troops_earned or 0)
        avatar_url = None
        if profile_thumb_key:
            try:
                avatar_url = create_presigned_download(profile_thumb_key)
            except Exception:
                avatar_url = profile_thumb_url or profile_url
        elif profile_key:
            try:
                avatar_url = create_presigned_download(profile_key)
            except Exception:
                avatar_url = profile_url
        else:
            avatar_url = profile_url

        def push_event(text: str):
            events.append({
                "user_id": user_id,
                "name": name,
                "profile_image_url": avatar_url,
                "text": text,
            })

        if solved:
            solved_count += 1
            if guesses_used == 1:
                push_event("aced it in 1 guess.")
            elif guesses_used in (2, 3):
                push_event(f"clutched it in {guesses_used} guesses.")
            elif guesses_used == 6:
                push_event("barely made it in 6 guesses.")
            else:
                guess_word = "guess" if guesses_used == 1 else "guesses"
                push_event(f"solved in {guesses_used} {guess_word}.")
        else:
            failed_count += 1
            push_event("failed to solve the word.")

        if used_dd and dd_success:
            push_event("scored a Double Down success.")

        if biggest_gain is None or troops_earned > biggest_gain[0]:
            biggest_gain = (troops_earned, user_id, name, avatar_url)

    if biggest_gain and biggest_gain[0] > 0:
        events.append({
            "user_id": biggest_gain[1],
            "name": biggest_gain[2],
            "profile_image_url": biggest_gain[3],
            "text": f"seized the biggest gain (+{biggest_gain[0]} troops).",
        })

    item_count = conn.execute(
        """
        SELECT COUNT(*)
        FROM campaign_item_events
        WHERE campaign_id = %s AND event_type = 'use' AND DATE(created_at) = %s
        """,
        (campaign_id, date_str),
    ).fetchone()[0]
    if item_count:
        events.append({
            "name": "System",
            "profile_image_url": "",
            "text": "Item usage recap coming soon.",
        })

    summary = None
    if solved_count or failed_count:
        summary_parts = []
        if solved_count:
            summary_parts.append(f"{solved_count} solved")
        if failed_count:
            summary_parts.append(f"{failed_count} failed")
        summary = f"Day recap: {', '.join(summary_parts)}."

    return summary, events


def _store_recap(conn, campaign_id: int, date_str: str, summary: str | None, highlights: list[dict]):
    conn.execute(
        """
        INSERT INTO campaign_daily_recaps (campaign_id, date, summary, highlights)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (campaign_id, date) DO UPDATE
        SET summary = EXCLUDED.summary,
            highlights = EXCLUDED.highlights
        """,
        (campaign_id, date_str, summary, json.dumps(highlights)),
    )


def build_and_store_recap(campaign_id: int, target_date: date):
    with get_db() as conn:
        summary, events = _build_recap_for_date(conn, campaign_id, target_date)
        if events:
            user_ids = {e.get("user_id") for e in events if isinstance(e, dict) and e.get("user_id")}
            if user_ids:
                member_rows = conn.execute(
                    """
                    SELECT cm.user_id, u.profile_image_url, u.profile_image_key,
                           u.profile_image_thumb_url, u.profile_image_thumb_key
                    FROM campaign_members cm
                    JOIN users u ON u.id = cm.user_id
                    WHERE cm.campaign_id = %s
                    """,
                    (campaign_id,),
                ).fetchall()
                by_id = {row[0]: row for row in member_rows}
                for entry in events:
                    if not isinstance(entry, dict):
                        continue
                    uid = entry.get("user_id")
                    if uid and uid in by_id:
                        _uid, _url, _key, _thumb_url, _thumb_key = by_id[uid]
                        avatar_url = None
                        if _thumb_key:
                            try:
                                avatar_url = create_presigned_download(_thumb_key)
                            except Exception:
                                avatar_url = _thumb_url or _url
                        elif _key:
                            try:
                                avatar_url = create_presigned_download(_key)
                            except Exception:
                                avatar_url = _url
                        else:
                            avatar_url = _url
                        entry["profile_image_url"] = avatar_url
        date_str = target_date.strftime("%Y-%m-%d")
        _store_recap(conn, campaign_id, date_str, summary, events)

        top_row = conn.execute(
            """
            SELECT user_id, troops_earned
            FROM campaign_user_daily_results
            WHERE campaign_id = %s AND date = %s
            ORDER BY troops_earned DESC, user_id ASC
            LIMIT 1
            """,
            (campaign_id, date_str),
        ).fetchone()
        if top_row and int(top_row[1] or 0) > 0:
            award_accolade(conn, campaign_id, top_row[0], "biggest_gain", date_str)

def _normalize_events(raw_events) -> list[dict]:
    if raw_events is None:
        return []
    if isinstance(raw_events, str):
        try:
            raw_events = json.loads(raw_events)
        except Exception:
            raw_events = []
    if not isinstance(raw_events, list):
        return []

    events: list[dict] = []
    for entry in raw_events:
        if isinstance(entry, str):
            name = ""
            text = entry
            match = re.match(
                r"^(?P<name>.+?)\s+"
                r"(?P<event>"
                r"aced it in 1 guess\."
                r"|clutched it in \d+ guesses\."
                r"|barely made it in 6 guesses\."
                r"|solved in \d+ guesses?\."
                r"|failed to solve the word\."
                r"|scored a Double Down success\."
                r"|seized the biggest gain \(\+\d+ troops\)\."
                r")$",
                entry,
            )
            if match:
                name = match.group("name").strip()
                text = match.group("event").strip()
            events.append({"name": name, "profile_image_url": "", "text": text})
        elif isinstance(entry, dict):
            events.append(entry)
    return events


def _resolve_avatars(conn, campaign_id: int, date_str: str, events: list[dict]) -> list[dict]:
    if not events:
        return events
    user_ids = {e.get("user_id") for e in events if isinstance(e, dict) and e.get("user_id")}
    name_set = {e.get("name") for e in events if isinstance(e, dict) and e.get("name")}
    if not user_ids and not name_set:
        return events

    member_rows = conn.execute(
        """
        SELECT cm.user_id, cm.display_name, u.first_name, u.last_name,
               u.profile_image_url, u.profile_image_key, u.profile_image_thumb_url, u.profile_image_thumb_key
        FROM campaign_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.campaign_id = %s
        """,
        (campaign_id,),
    ).fetchall()
    by_id = {row[0]: row for row in member_rows}

    def _norm(value: str | None) -> str:
        return (value or "").strip().lower()

    by_name = {}
    for row in member_rows:
        display = row[1]
        first = row[2] or ""
        last = row[3] or ""
        full = f"{first} {last}".strip()
        if display:
            by_name.setdefault(_norm(display), []).append(row)
        if full:
            by_name.setdefault(_norm(full), []).append(row)
        if first:
            by_name.setdefault(_norm(first), []).append(row)
        if last:
            by_name.setdefault(_norm(last), []).append(row)

    daily_rows = conn.execute(
        """
        SELECT r.user_id, cm.display_name, u.first_name, u.last_name,
               u.profile_image_url, u.profile_image_key, u.profile_image_thumb_url, u.profile_image_thumb_key
        FROM campaign_user_daily_results r
        JOIN campaign_members cm ON cm.user_id = r.user_id AND cm.campaign_id = r.campaign_id
        JOIN users u ON u.id = r.user_id
        WHERE r.campaign_id = %s AND r.date = %s
        """,
        (campaign_id, date_str),
    ).fetchall()
    for row in daily_rows:
        display = row[1]
        first = row[2] or ""
        last = row[3] or ""
        full = f"{first} {last}".strip()
        if display:
            by_name.setdefault(_norm(display), []).append(row)
        if full:
            by_name.setdefault(_norm(full), []).append(row)
        if first:
            by_name.setdefault(_norm(first), []).append(row)
        if last:
            by_name.setdefault(_norm(last), []).append(row)

    for entry in events:
        if not isinstance(entry, dict):
            continue
        uid = entry.get("user_id")
        if not uid and entry.get("name"):
            candidates = by_name.get(_norm(entry.get("name")), [])
            if len(candidates) == 1:
                uid = candidates[0][0]
                entry["user_id"] = uid
        if uid and uid in by_id:
            _uid, _display, _first, _last, _url, _key, _thumb_url, _thumb_key = by_id[uid]
            avatar_url = None
            if _thumb_key:
                try:
                    avatar_url = create_presigned_download(_thumb_key)
                except Exception:
                    avatar_url = _thumb_url or _url
            elif _key:
                try:
                    avatar_url = create_presigned_download(_key)
                except Exception:
                    avatar_url = _url
            else:
                avatar_url = _url
            entry["profile_image_url"] = avatar_url

    return events


def _load_stored_recap(conn, campaign_id: int, date_str: str):
    recap_row = conn.execute(
        "SELECT summary, highlights FROM campaign_daily_recaps WHERE campaign_id = %s AND date = %s",
        (campaign_id, date_str),
    ).fetchone()
    if not recap_row:
        return None, []
    summary = recap_row[0]
    events = _normalize_events(recap_row[1])
    events = _resolve_avatars(conn, campaign_id, date_str, events)
    return summary, events




def get_campaign_recap(campaign_id: int, requester_id: int, day: int | None = None):
    with get_db() as conn:
        member_row = conn.execute(
            "SELECT 1 FROM campaign_members WHERE campaign_id = %s AND user_id = %s",
            (campaign_id, requester_id),
        ).fetchone()
        if not member_row:
            raise HTTPException(status_code=403, detail="Not a member of this campaign")

        start_date, cycle_length, _is_admin = _get_campaign_start(conn, campaign_id)
        today_ct = datetime.now(ZoneInfo("America/Chicago")).date()
        current_day = _get_day_for_date(start_date, today_ct)

        if day is None:
            day = current_day
        day = max(1, min(int(day), cycle_length or int(day)))
        target_date = _get_date_for_day(start_date, day)
        date_str = target_date.strftime("%Y-%m-%d")

        summary = None
        events: list[dict] = []

        if day == current_day:
            summary, events = _build_recap_for_date(conn, campaign_id, target_date)
            events = _resolve_avatars(conn, campaign_id, date_str, events)

        else:
            summary, events = _load_stored_recap(conn, campaign_id, date_str)
            if not events:
                summary, events = _build_recap_for_date(conn, campaign_id, target_date)
                _store_recap(conn, campaign_id, date_str, summary, events)
                events = _resolve_avatars(conn, campaign_id, date_str, events)

        day_number = _get_day_for_date(start_date, target_date)
        date_label = target_date.strftime("%b %d, %Y")

    highlights = []
    if isinstance(events, list):
        for entry in events:
            if isinstance(entry, dict):
                text = entry.get("text")
                name = entry.get("name")
                if name and text:
                    highlights.append(f"{name} {text}")
                elif text:
                    highlights.append(text)
            elif isinstance(entry, str):
                highlights.append(entry)

    return {
        "date": date_str,
        "date_label": f"Recap for {date_label}",
        "summary": summary,
        "highlights": highlights,
        "events": events,
        "day": day_number,
    }
