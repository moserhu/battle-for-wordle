import json
from typing import Optional

from fastapi import HTTPException
from app.crud import get_db


MAX_LIMIT = 365


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
                cm.army_image_thumb_key
            FROM campaign_members cm
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
