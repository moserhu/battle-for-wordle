from __future__ import annotations

from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo

ACCOLADE_LABELS = {
    "ace": "Ace (1 guess)",
    "clutch": "Clutch (2-3 guesses)",
    "barely_made_it": "Barely Made It (6 guesses)",
    "first_solver": "First Solver of the Day",
    "biggest_gain": "Biggest Gain",
    "comeback": "Comeback",
    "big_spender": "Big Spender",
    "hoarder": "Hoarder",
    "shop_regular": "Shop Regular",
    "item_master": "Item Master",
    "saves_the_day": "Saves the Day",
    "top_3": "Top 3 Finish",
    "veteran_7": "Veteran (7 days)",
    "veteran_30": "Veteran (30 days)",
    "veteran_100": "Veteran (100 days)",
    "perfect_week": "Perfect Week (7 streak)",
    "iron_will": "Iron Will",
    "marathon": "Marathon (10 streak)",
    "early_bird": "Early Bird",
    "night_owl": "Night Owl",
    "late_save": "Late Save",
    "lucky_strike": "Lucky Strike",
    "chaos_king": "Chaos King",
}

SHOP_REGULAR_THRESHOLD = 10
ITEM_MASTER_THRESHOLD = 50

# TODO: confirm thresholds
BIG_SPENDER_THRESHOLD = 50  # coins spent in a day
HOARDER_THRESHOLD = 100  # coins balance


def _ensure_ct(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=ZoneInfo("America/Chicago"))
    return dt.astimezone(ZoneInfo("America/Chicago"))


def _day_bounds_ct(target_date: date) -> tuple[datetime, datetime]:
    start = datetime(
        target_date.year, target_date.month, target_date.day, tzinfo=ZoneInfo("America/Chicago")
    )
    return start, start + timedelta(days=1)


def award_accolade(conn, campaign_id: int, user_id: int, accolade_key: str, date_str: str) -> bool:
    if accolade_key not in ACCOLADE_LABELS:
        return False
    inserted = conn.execute(
        """
        INSERT INTO user_accolade_events (user_id, campaign_id, accolade_key, date)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, campaign_id, accolade_key, date) DO NOTHING
        """,
        (user_id, campaign_id, accolade_key, date_str),
    ).rowcount
    if not inserted:
        return False

    conn.execute(
        """
        INSERT INTO user_accolade_stats (user_id, campaign_id, accolade_key, count, last_awarded_at)
        VALUES (%s, %s, %s, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, campaign_id, accolade_key)
        DO UPDATE SET count = user_accolade_stats.count + 1,
                      last_awarded_at = CURRENT_TIMESTAMP
        """,
        (user_id, campaign_id, accolade_key),
    )
    conn.execute(
        """
        INSERT INTO campaign_accolade_stats (campaign_id, accolade_key, count, last_awarded_at)
        VALUES (%s, %s, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (campaign_id, accolade_key)
        DO UPDATE SET count = campaign_accolade_stats.count + 1,
                      last_awarded_at = CURRENT_TIMESTAMP
        """,
        (campaign_id, accolade_key),
    )
    conn.execute(
        """
        INSERT INTO global_accolade_stats (accolade_key, count, last_awarded_at)
        VALUES (%s, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (accolade_key)
        DO UPDATE SET count = global_accolade_stats.count + 1,
                      last_awarded_at = CURRENT_TIMESTAMP
        """,
        (accolade_key,),
    )
    return True


def list_user_accolades(conn, user_id: int, campaign_id: int):
    rows = conn.execute(
        """
        SELECT accolade_key, count
        FROM user_accolade_stats
        WHERE user_id = %s AND campaign_id = %s
        """,
        (user_id, campaign_id),
    ).fetchall()
    by_key = {row[0]: int(row[1]) for row in rows}
    return [
        {"key": key, "label": ACCOLADE_LABELS[key], "count": by_key.get(key, 0)}
        for key in ACCOLADE_LABELS
    ]


def is_lucky_strike(results_data: list) -> bool:
    if len(results_data) < 3:
        return False
    first = results_data[0] or []
    second = results_data[1] or []
    if len(first) != 5 or len(second) != 5:
        return False
    return all(r == "absent" for r in first) and all(r == "absent" for r in second)


def classify_time_accolades(completed_at: datetime, target_date: date) -> tuple[bool, bool, bool]:
    completed_ct = _ensure_ct(completed_at)
    if not completed_ct:
        return False, False, False
    start, end = _day_bounds_ct(target_date)
    early = completed_ct <= start + timedelta(hours=1)
    night = completed_ct >= end - timedelta(hours=1)
    late_save = completed_ct >= end - timedelta(minutes=10)
    return early, night, late_save
