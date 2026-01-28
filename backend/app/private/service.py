import json
from typing import Optional

from fastapi import HTTPException
from app.crud import get_db


MAX_LIMIT = 365
MAX_OFFSET = 10000


def _clamp_limit(limit: Optional[int], default: int = 30) -> int:
    if limit is None:
        return default
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        return default
    if limit <= 0:
        return default
    return min(limit, MAX_LIMIT)


def _clamp_offset(offset: Optional[int]) -> int:
    if offset is None:
        return 0
    try:
        offset = int(offset)
    except (TypeError, ValueError):
        return 0
    if offset < 0:
        return 0
    return min(offset, MAX_OFFSET)


def _date_filters(date_from: Optional[str], date_to: Optional[str]) -> tuple[str, list]:
    clauses = []
    params: list = []
    if date_from:
        clauses.append("date >= %s")
        params.append(date_from)
    if date_to:
        clauses.append("date <= %s")
        params.append(date_to)
    if not clauses:
        return "", params
    return " WHERE " + " AND ".join(clauses), params


def list_campaigns():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT
                c.id,
                c.name,
                c.start_date,
                c.cycle_length,
                COALESCE(c.is_admin_campaign, FALSE) AS is_admin_campaign,
                (
                    SELECT COUNT(*)
                    FROM campaign_members cm
                    WHERE cm.campaign_id = c.id
                ) AS member_count
            FROM campaigns c
            ORDER BY c.id DESC
        """).fetchall()
    return [
        {
            "campaign_id": row[0],
            "name": row[1],
            "start_date": row[2],
            "cycle_length": row[3],
            "is_admin_campaign": bool(row[4]),
            "member_count": row[5],
        }
        for row in rows
    ]


def get_campaign_details(campaign_id: int):
    with get_db() as conn:
        row = conn.execute("""
            SELECT
                id,
                name,
                owner_id,
                invite_code,
                start_date,
                cycle_length,
                COALESCE(is_admin_campaign, FALSE),
                king,
                ruler_id,
                ruler_title,
                ruler_background_image_url,
                ruler_background_image_key
            FROM campaigns
            WHERE id = %s
        """, (campaign_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Campaign not found")
    return {
        "campaign_id": row[0],
        "name": row[1],
        "owner_id": row[2],
        "invite_code": row[3],
        "start_date": row[4],
        "cycle_length": row[5],
        "is_admin_campaign": bool(row[6]),
        "king": row[7],
        "ruler_id": row[8],
        "ruler_title": row[9],
        "ruler_background_image_url": row[10],
        "ruler_background_image_key": row[11],
    }


def list_users(limit: Optional[int], offset: Optional[int]):
    limit = _clamp_limit(limit)
    offset = _clamp_offset(offset)
    with get_db() as conn:
        rows = conn.execute("""
            SELECT
                id,
                first_name,
                last_name,
                campaigns,
                total_guesses,
                correct_guesses,
                campaign_wins,
                campaign_losses,
                clicked_update,
                COALESCE(is_admin, FALSE),
                profile_image_url,
                profile_image_key,
                profile_image_thumb_url,
                profile_image_thumb_key
            FROM users
            ORDER BY id ASC
            LIMIT %s OFFSET %s
        """, (limit, offset)).fetchall()
    return [
        {
            "user_id": row[0],
            "first_name": row[1],
            "last_name": row[2],
            "campaigns": row[3],
            "total_guesses": row[4],
            "correct_guesses": row[5],
            "campaign_wins": row[6],
            "campaign_losses": row[7],
            "clicked_update": row[8],
            "is_admin": bool(row[9]),
            "profile_image_url": row[10],
            "profile_image_key": row[11],
            "profile_image_thumb_url": row[12],
            "profile_image_thumb_key": row[13],
        }
        for row in rows
    ]


def get_user_campaign_stats(user_id: Optional[int], campaign_id: Optional[int], limit: Optional[int]):
    limit = _clamp_limit(limit)
    clauses = []
    params: list = []
    if user_id is not None:
        clauses.append("user_id = %s")
        params.append(user_id)
    if campaign_id is not None:
        clauses.append("campaign_id = %s")
        params.append(campaign_id)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT
                user_id,
                campaign_id,
                total_solves,
                total_fails,
                total_guesses_on_solves,
                total_days_played,
                current_streak,
                longest_streak,
                streak_recovery_days,
                double_down_used,
                double_down_success,
                double_down_bonus_troops,
                coins_earned_total
            FROM user_campaign_stats
            {where_sql}
            ORDER BY campaign_id DESC, user_id ASC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "user_id": row[0],
            "campaign_id": row[1],
            "total_solves": row[2],
            "total_fails": row[3],
            "total_guesses_on_solves": row[4],
            "total_days_played": row[5],
            "current_streak": row[6],
            "longest_streak": row[7],
            "streak_recovery_days": row[8],
            "double_down_used": row[9],
            "double_down_success": row[10],
            "double_down_bonus_troops": row[11],
            "coins_earned_total": row[12],
        }
        for row in rows
    ]


def get_user_daily_results(
    user_id: Optional[int],
    campaign_id: Optional[int],
    date_from: Optional[str],
    date_to: Optional[str],
    limit: Optional[int],
):
    limit = _clamp_limit(limit)
    clauses = []
    params: list = []
    if user_id is not None:
        clauses.append("user_id = %s")
        params.append(user_id)
    if campaign_id is not None:
        clauses.append("campaign_id = %s")
        params.append(campaign_id)
    date_sql, date_params = _date_filters(date_from, date_to)
    if date_sql:
        clauses.append(date_sql.replace(" WHERE ", ""))
        params.extend(date_params)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT
                user_id,
                campaign_id,
                date,
                word,
                guesses_used,
                solved,
                first_guess_word,
                used_double_down,
                double_down_success,
                double_down_bonus_troops,
                troops_earned,
                coins_earned,
                completed_at
            FROM campaign_user_daily_results
            {where_sql}
            ORDER BY date DESC, user_id ASC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "user_id": row[0],
            "campaign_id": row[1],
            "date": row[2],
            "word": row[3],
            "guesses_used": row[4],
            "solved": row[5],
            "first_guess_word": row[6],
            "used_double_down": row[7],
            "double_down_success": row[8],
            "double_down_bonus_troops": row[9],
            "troops_earned": row[10],
            "coins_earned": row[11],
            "completed_at": row[12],
        }
        for row in rows
    ]


def get_user_accolade_stats(user_id: Optional[int], campaign_id: Optional[int], limit: Optional[int]):
    limit = _clamp_limit(limit)
    clauses = []
    params: list = []
    if user_id is not None:
        clauses.append("user_id = %s")
        params.append(user_id)
    if campaign_id is not None:
        clauses.append("campaign_id = %s")
        params.append(campaign_id)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT user_id, campaign_id, accolade_key, count, last_awarded_at
            FROM user_accolade_stats
            {where_sql}
            ORDER BY count DESC, accolade_key ASC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "user_id": row[0],
            "campaign_id": row[1],
            "accolade_key": row[2],
            "count": row[3],
            "last_awarded_at": row[4],
        }
        for row in rows
    ]


def get_user_accolade_events(
    user_id: Optional[int],
    campaign_id: Optional[int],
    date_from: Optional[str],
    date_to: Optional[str],
    limit: Optional[int],
):
    limit = _clamp_limit(limit)
    clauses = []
    params: list = []
    if user_id is not None:
        clauses.append("user_id = %s")
        params.append(user_id)
    if campaign_id is not None:
        clauses.append("campaign_id = %s")
        params.append(campaign_id)
    date_sql, date_params = _date_filters(date_from, date_to)
    if date_sql:
        clauses.append(date_sql.replace(" WHERE ", ""))
        params.extend(date_params)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT user_id, campaign_id, accolade_key, date, created_at
            FROM user_accolade_events
            {where_sql}
            ORDER BY date DESC, user_id ASC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "user_id": row[0],
            "campaign_id": row[1],
            "accolade_key": row[2],
            "date": row[3],
            "created_at": row[4],
        }
        for row in rows
    ]


def list_campaign_members(campaign_id: int):
    with get_db() as conn:
        campaign_row = conn.execute(
            "SELECT owner_id FROM campaigns WHERE id = %s",
            (campaign_id,)
        ).fetchone()
        if not campaign_row:
            raise HTTPException(status_code=404, detail="Campaign not found")
        owner_id = campaign_row[0]

        rows = conn.execute("""
            SELECT
                cm.user_id,
                cm.display_name,
                cm.color,
                cm.score,
                cm.army_name,
                cm.army_image_url,
                cm.army_image_thumb_url,
                cm.army_image_key,
                cm.army_image_thumb_key,
                COALESCE(cc.coins, 0) AS coins
            FROM campaign_members cm
            LEFT JOIN campaign_coins cc
                ON cc.user_id = cm.user_id AND cc.campaign_id = cm.campaign_id
            WHERE cm.campaign_id = %s
            ORDER BY cm.score DESC, cm.user_id ASC
        """, (campaign_id,)).fetchall()
    return [
        {
            "user_id": row[0],
            "display_name": row[1],
            "color": row[2],
            "score": row[3],
            "army_name": row[4],
            "army_image_url": row[5],
            "army_image_thumb_url": row[6],
            "army_image_key": row[7],
            "army_image_thumb_key": row[8],
            "coins": row[9],
            "is_owner": row[0] == owner_id,
        }
        for row in rows
    ]


def get_global_daily_stats(date_from: Optional[str], date_to: Optional[str], limit: Optional[int]):
    where_sql, params = _date_filters(date_from, date_to)
    limit = _clamp_limit(limit)
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT
                date,
                total_campaigns_completed,
                total_players,
                total_guesses,
                guess_1,
                guess_2,
                guess_3,
                guess_4,
                guess_5,
                guess_6
            FROM global_daily_stats
            {where_sql}
            ORDER BY date DESC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "date": row[0],
            "total_campaigns_completed": row[1],
            "total_players": row[2],
            "total_guesses": row[3],
            "guess_1": row[4],
            "guess_2": row[5],
            "guess_3": row[6],
            "guess_4": row[7],
            "guess_5": row[8],
            "guess_6": row[9],
        }
        for row in rows
    ]


def get_global_word_stats(limit: Optional[int], order_by: str = "attempts"):
    allowed = {"attempts", "solves", "fails", "last_seen"}
    order_by = order_by if order_by in allowed else "attempts"
    limit = _clamp_limit(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT word, attempts, solves, fails, first_seen, last_seen
            FROM global_word_stats
            ORDER BY {order_by} DESC NULLS LAST
            LIMIT %s
        """, (limit,)).fetchall()
    return [
        {
            "word": row[0],
            "attempts": row[1],
            "solves": row[2],
            "fails": row[3],
            "first_seen": row[4],
            "last_seen": row[5],
        }
        for row in rows
    ]


def get_global_item_stats(limit: Optional[int], order_by: str = "uses"):
    allowed = {"uses", "targets", "last_used_at"}
    order_by = order_by if order_by in allowed else "uses"
    limit = _clamp_limit(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT item_key, uses, targets, last_used_at
            FROM global_item_stats
            ORDER BY {order_by} DESC NULLS LAST
            LIMIT %s
        """, (limit,)).fetchall()
    return [
        {
            "item_key": row[0],
            "uses": row[1],
            "targets": row[2],
            "last_used_at": row[3],
        }
        for row in rows
    ]


def get_global_accolade_stats(limit: Optional[int]):
    limit = _clamp_limit(limit)
    with get_db() as conn:
        rows = conn.execute("""
            SELECT accolade_key, count, last_awarded_at
            FROM global_accolade_stats
            ORDER BY count DESC, accolade_key ASC
            LIMIT %s
        """, (limit,)).fetchall()
    return [
        {
            "accolade_key": row[0],
            "count": row[1],
            "last_awarded_at": row[2],
        }
        for row in rows
    ]


def get_global_high_scores(limit: Optional[int]):
    limit = _clamp_limit(limit)
    with get_db() as conn:
        rows = conn.execute("""
            SELECT
                ended_on,
                user_id,
                troops,
                display_name,
                campaign_id,
                campaign_name,
                campaign_length
            FROM global_high_scores
            ORDER BY troops DESC, ended_on DESC
            LIMIT %s
        """, (limit,)).fetchall()
    return [
        {
            "ended_on": row[0],
            "user_id": row[1],
            "troops": row[2],
            "display_name": row[3],
            "campaign_id": row[4],
            "campaign_name": row[5],
            "campaign_length": row[6],
        }
        for row in rows
    ]


def get_global_streak_stats():
    with get_db() as conn:
        row = conn.execute("""
            SELECT id, highest_streak, user_id, campaign_id, updated_at
            FROM global_streak_stats
            WHERE id = 1
        """).fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "highest_streak": row[1],
        "user_id": row[2],
        "campaign_id": row[3],
        "updated_at": row[4],
    }


def get_global_user_streaks(limit: Optional[int]):
    limit = _clamp_limit(limit)
    with get_db() as conn:
        rows = conn.execute("""
            SELECT user_id, highest_streak, updated_at
            FROM global_user_streaks
            ORDER BY highest_streak DESC, updated_at DESC
            LIMIT %s
        """, (limit,)).fetchall()
    return [
        {
            "user_id": row[0],
            "highest_streak": row[1],
            "updated_at": row[2],
        }
        for row in rows
    ]


def get_campaign_daily_stats(campaign_id: int, date_from: Optional[str], date_to: Optional[str], limit: Optional[int]):
    where_sql, params = _date_filters(date_from, date_to)
    limit = _clamp_limit(limit)
    params = [campaign_id] + params + [limit]
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT
                date,
                total_troops,
                avg_troops_per_player,
                highest_troops,
                completed_count,
                member_count,
                completion_rate,
                fast_solve_count,
                clutch_wins,
                double_down_used,
                double_down_success,
                participation_pct,
                hardest_word,
                easiest_word
            FROM campaign_daily_stats
            WHERE campaign_id = %s
            {where_sql.replace(" WHERE ", " AND ")}
            ORDER BY date DESC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "date": row[0],
            "total_troops": row[1],
            "avg_troops_per_player": row[2],
            "highest_troops": row[3],
            "completed_count": row[4],
            "member_count": row[5],
            "completion_rate": row[6],
            "fast_solve_count": row[7],
            "clutch_wins": row[8],
            "double_down_used": row[9],
            "double_down_success": row[10],
            "participation_pct": row[11],
            "hardest_word": row[12],
            "easiest_word": row[13],
        }
        for row in rows
    ]


def get_campaign_daily_troops(
    campaign_id: int,
    user_id: Optional[int],
    date_from: Optional[str],
    date_to: Optional[str],
    limit: Optional[int],
):
    limit = _clamp_limit(limit)
    clauses = ["campaign_id = %s"]
    params: list = [campaign_id]
    if user_id is not None:
        clauses.append("user_id = %s")
        params.append(user_id)
    date_sql, date_params = _date_filters(date_from, date_to)
    if date_sql:
        clauses.append(date_sql.replace(" WHERE ", ""))
        params.extend(date_params)
    where_sql = f"WHERE {' AND '.join(clauses)}"
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT user_id, campaign_id, date, troops
            FROM campaign_daily_troops
            {where_sql}
            ORDER BY date DESC, user_id ASC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "user_id": row[0],
            "campaign_id": row[1],
            "date": row[2],
            "troops": row[3],
        }
        for row in rows
    ]


def get_campaign_word_stats(campaign_id: int, date_from: Optional[str], date_to: Optional[str], limit: Optional[int], order_by: str = "solved_count"):
    allowed = {"solved_count", "failed_count", "date"}
    order_by = order_by if order_by in allowed else "solved_count"
    where_sql, params = _date_filters(date_from, date_to)
    limit = _clamp_limit(limit)
    params = [campaign_id] + params + [limit]
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT date, word, solved_count, failed_count
            FROM campaign_daily_word_stats
            WHERE campaign_id = %s
            {where_sql.replace(" WHERE ", " AND ")}
            ORDER BY {order_by} DESC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "date": row[0],
            "word": row[1],
            "solved_count": row[2],
            "failed_count": row[3],
        }
        for row in rows
    ]


def get_campaign_accolade_stats(campaign_id: int, limit: Optional[int]):
    limit = _clamp_limit(limit)
    with get_db() as conn:
        rows = conn.execute("""
            SELECT accolade_key, count, last_awarded_at
            FROM campaign_accolade_stats
            WHERE campaign_id = %s
            ORDER BY count DESC, accolade_key ASC
            LIMIT %s
        """, (campaign_id, limit)).fetchall()
    return [
        {
            "accolade_key": row[0],
            "count": row[1],
            "last_awarded_at": row[2],
        }
        for row in rows
    ]


def get_campaign_guess_states(
    campaign_id: int,
    user_id: Optional[int],
    date_from: Optional[str],
    date_to: Optional[str],
    limit: Optional[int],
):
    limit = _clamp_limit(limit)
    clauses = ["campaign_id = %s"]
    params: list = [campaign_id]
    if user_id is not None:
        clauses.append("user_id = %s")
        params.append(user_id)
    date_sql, date_params = _date_filters(date_from, date_to)
    if date_sql:
        clauses.append(date_sql.replace(" WHERE ", ""))
        params.extend(date_params)
    where_sql = f"WHERE {' AND '.join(clauses)}"
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT user_id, campaign_id, date, guesses, results, letter_status, current_row, game_over
            FROM campaign_guess_states
            {where_sql}
            ORDER BY date DESC, user_id ASC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "user_id": row[0],
            "campaign_id": row[1],
            "date": row[2],
            "guesses": row[3],
            "results": row[4],
            "letter_status": row[5],
            "current_row": row[6],
            "game_over": row[7],
        }
        for row in rows
    ]


def get_campaign_first_guesses(
    campaign_id: int,
    user_id: Optional[int],
    date_from: Optional[str],
    date_to: Optional[str],
    limit: Optional[int],
):
    limit = _clamp_limit(limit)
    clauses = ["campaign_id = %s"]
    params: list = [campaign_id]
    if user_id is not None:
        clauses.append("user_id = %s")
        params.append(user_id)
    date_sql, date_params = _date_filters(date_from, date_to)
    if date_sql:
        clauses.append(date_sql.replace(" WHERE ", ""))
        params.extend(date_params)
    where_sql = f"WHERE {' AND '.join(clauses)}"
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT user_id, campaign_id, date, word
            FROM campaign_first_guesses
            {where_sql}
            ORDER BY date DESC, user_id ASC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "user_id": row[0],
            "campaign_id": row[1],
            "date": row[2],
            "word": row[3],
        }
        for row in rows
    ]


def get_campaign_item_usage(campaign_id: int, limit: Optional[int]):
    limit = _clamp_limit(limit)
    with get_db() as conn:
        rows = conn.execute("""
            SELECT
                item_key,
                COUNT(*) AS uses,
                SUM(CASE WHEN target_user_id IS NOT NULL THEN 1 ELSE 0 END) AS targets,
                MAX(created_at) AS last_used_at
            FROM campaign_item_events
            WHERE campaign_id = %s
            GROUP BY item_key
            ORDER BY uses DESC, item_key ASC
            LIMIT %s
        """, (campaign_id, limit)).fetchall()
    return [
        {
            "item_key": row[0],
            "uses": row[1],
            "targets": row[2],
            "last_used_at": row[3],
        }
        for row in rows
    ]


def get_campaign_shop_rotation(
    campaign_id: int,
    user_id: Optional[int],
    date_from: Optional[str],
    date_to: Optional[str],
    limit: Optional[int],
):
    limit = _clamp_limit(limit)
    clauses = ["campaign_id = %s"]
    params: list = [campaign_id]
    if user_id is not None:
        clauses.append("user_id = %s")
        params.append(user_id)
    date_sql, date_params = _date_filters(date_from, date_to)
    if date_sql:
        clauses.append(date_sql.replace(" WHERE ", ""))
        params.extend(date_params)
    where_sql = f"WHERE {' AND '.join(clauses)}"
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT user_id, campaign_id, date, items, reshuffles, updated_at
            FROM campaign_shop_rotation
            {where_sql}
            ORDER BY date DESC, user_id ASC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "user_id": row[0],
            "campaign_id": row[1],
            "date": row[2],
            "items": row[3],
            "reshuffles": row[4],
            "updated_at": row[5],
        }
        for row in rows
    ]


def get_campaign_shop_log(
    campaign_id: int,
    user_id: Optional[int],
    event_type: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    limit: Optional[int],
):
    limit = _clamp_limit(limit)
    clauses = ["campaign_id = %s"]
    params: list = [campaign_id]
    if user_id is not None:
        clauses.append("user_id = %s")
        params.append(user_id)
    if event_type:
        clauses.append("event_type = %s")
        params.append(event_type)
    date_sql, date_params = _date_filters(date_from, date_to)
    if date_sql:
        clauses.append(date_sql.replace(" WHERE ", ""))
        params.extend(date_params)
    where_sql = f"WHERE {' AND '.join(clauses)}"
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT id, user_id, campaign_id, event_type, item_key, details, created_at
            FROM campaign_shop_log
            {where_sql}
            ORDER BY created_at DESC, id DESC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "id": row[0],
            "user_id": row[1],
            "campaign_id": row[2],
            "event_type": row[3],
            "item_key": row[4],
            "details": row[5],
            "created_at": row[6],
        }
        for row in rows
    ]


def get_campaign_item_events(
    campaign_id: int,
    user_id: Optional[int],
    target_user_id: Optional[int],
    event_type: Optional[str],
    item_key: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    limit: Optional[int],
):
    limit = _clamp_limit(limit)
    clauses = ["campaign_id = %s"]
    params: list = [campaign_id]
    if user_id is not None:
        clauses.append("user_id = %s")
        params.append(user_id)
    if target_user_id is not None:
        clauses.append("target_user_id = %s")
        params.append(target_user_id)
    if event_type:
        clauses.append("event_type = %s")
        params.append(event_type)
    if item_key:
        clauses.append("item_key = %s")
        params.append(item_key)
    date_sql, date_params = _date_filters(date_from, date_to)
    if date_sql:
        clauses.append(date_sql.replace(" WHERE ", ""))
        params.extend(date_params)
    where_sql = f"WHERE {' AND '.join(clauses)}"
    params.append(limit)
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT id, user_id, campaign_id, item_key, target_user_id, event_type, details, created_at
            FROM campaign_item_events
            {where_sql}
            ORDER BY created_at DESC, id DESC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "id": row[0],
            "user_id": row[1],
            "campaign_id": row[2],
            "item_key": row[3],
            "target_user_id": row[4],
            "event_type": row[5],
            "details": row[6],
            "created_at": row[7],
        }
        for row in rows
    ]


def get_campaign_recaps(campaign_id: int, date_from: Optional[str], date_to: Optional[str], limit: Optional[int]):
    where_sql, params = _date_filters(date_from, date_to)
    limit = _clamp_limit(limit)
    params = [campaign_id] + params + [limit]
    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT date, summary, highlights, created_at
            FROM campaign_daily_recaps
            WHERE campaign_id = %s
            {where_sql.replace(" WHERE ", " AND ")}
            ORDER BY date DESC
            LIMIT %s
        """, params).fetchall()
    return [
        {
            "date": row[0],
            "summary": row[1],
            "highlights": row[2],
            "created_at": row[3],
        }
        for row in rows
    ]


def get_global_summary(
    daily_limit: Optional[int],
    word_limit: Optional[int],
    item_limit: Optional[int],
    accolade_limit: Optional[int],
):
    return {
        "daily_stats": get_global_daily_stats(None, None, daily_limit),
        "word_stats": get_global_word_stats(word_limit, "attempts"),
        "item_stats": get_global_item_stats(item_limit, "uses"),
        "accolade_stats": get_global_accolade_stats(accolade_limit),
    }


def get_campaign_summary(
    campaign_id: int,
    daily_limit: Optional[int],
    word_limit: Optional[int],
    item_limit: Optional[int],
    accolade_limit: Optional[int],
    recap_limit: Optional[int],
):
    return {
        "campaign_id": campaign_id,
        "daily_stats": get_campaign_daily_stats(campaign_id, None, None, daily_limit),
        "word_stats": get_campaign_word_stats(campaign_id, None, None, word_limit, "solved_count"),
        "item_stats": get_campaign_item_usage(campaign_id, item_limit),
        "accolade_stats": get_campaign_accolade_stats(campaign_id, accolade_limit),
        "recaps": get_campaign_recaps(campaign_id, None, None, recap_limit),
    }


def adjust_campaign_balances(
    campaign_id: int,
    user_id: int,
    coins_delta: Optional[int] = None,
    coins_set: Optional[int] = None,
    score_delta: Optional[int] = None,
    score_set: Optional[int] = None,
    dry_run: bool = False,
):
    if coins_delta is None and coins_set is None and score_delta is None and score_set is None:
        raise HTTPException(status_code=400, detail="No adjustments provided")

    with get_db() as conn:
        member_row = conn.execute("""
            SELECT score
            FROM campaign_members
            WHERE user_id = %s AND campaign_id = %s
        """, (user_id, campaign_id)).fetchone()
        if not member_row:
            raise HTTPException(status_code=404, detail="Campaign membership not found")

        response = {"campaign_id": campaign_id, "user_id": user_id, "dry_run": bool(dry_run)}

        if coins_delta is not None or coins_set is not None:
            coins_row = conn.execute("""
                SELECT coins
                FROM campaign_coins
                WHERE user_id = %s AND campaign_id = %s
            """, (user_id, campaign_id)).fetchone()
            current_coins = coins_row[0] if coins_row else 0
            if coins_set is not None:
                next_coins = max(0, int(coins_set))
            else:
                next_coins = max(0, current_coins + int(coins_delta or 0))

            if not dry_run:
                if coins_row:
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
            response["coins"] = next_coins

        if score_delta is not None or score_set is not None:
            current_score = member_row[0] or 0
            if score_set is not None:
                next_score = max(0, int(score_set))
            else:
                next_score = max(0, current_score + int(score_delta or 0))

            if not dry_run:
                conn.execute("""
                    UPDATE campaign_members
                    SET score = %s
                    WHERE user_id = %s AND campaign_id = %s
                """, (next_score, user_id, campaign_id))
            response["score"] = next_score

        if not dry_run:
            _log_private_audit(
                conn,
                endpoint="/api/private/campaign/adjust-balances",
                campaign_id=campaign_id,
                user_id=user_id,
                action="adjust_balances",
                payload={
                    "coins_delta": coins_delta,
                    "coins_set": coins_set,
                    "score_delta": score_delta,
                    "score_set": score_set,
                    "result": {"coins": response.get("coins"), "score": response.get("score")},
                },
            )

    return response


def _log_private_audit(conn, endpoint: str, campaign_id: int | None, user_id: int | None, action: str, payload: dict):
    conn.execute("""
        INSERT INTO private_api_audit (endpoint, campaign_id, user_id, action, payload)
        VALUES (%s, %s, %s, %s, %s::jsonb)
    """, (endpoint, campaign_id, user_id, action, json.dumps(payload)))
