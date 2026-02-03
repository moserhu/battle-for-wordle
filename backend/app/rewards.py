from __future__ import annotations

from fastapi import HTTPException


ORACLE_WHISPER_KEY = "oracle_whisper"


def get_weekly_reward_pending(conn, user_id: int, campaign_id: int):
    """Return pending weekly reward details for the current cycle, if user is the winner."""

    start_row = conn.execute(
        "SELECT start_date FROM campaigns WHERE id = %s",
        (campaign_id,),
    ).fetchone()
    cycle_start_date = start_row[0] if start_row else None
    if not cycle_start_date:
        return {"pending": False}

    reward_row = conn.execute(
        """
        SELECT winner_user_id, recipient_count, whispers_per_recipient, fulfilled
        FROM campaign_cycle_rewards
        WHERE campaign_id = %s AND cycle_start_date = %s
        """,
        (campaign_id, cycle_start_date),
    ).fetchone()

    if not reward_row:
        return {"pending": False}

    winner_user_id, recipient_count, whispers_per_recipient, fulfilled = reward_row
    if bool(fulfilled) or winner_user_id != user_id:
        return {"pending": False}

    # Candidate list: campaign members excluding winner
    rows = conn.execute(
        """
        SELECT cm.user_id, cm.display_name, u.first_name, u.last_name
        FROM campaign_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.campaign_id = %s AND cm.user_id <> %s
        ORDER BY COALESCE(NULLIF(cm.display_name, ''), NULLIF(u.first_name || ' ' || u.last_name, ' '))
        """,
        (campaign_id, user_id),
    ).fetchall()

    candidates = []
    for uid, display_name, first_name, last_name in rows:
        fallback = f"{first_name or ''} {last_name or ''}".strip()
        candidates.append({
            "user_id": uid,
            "display_name": (display_name or fallback or f"User {uid}").strip(),
        })

    return {
        "pending": True,
        "cycle_start_date": cycle_start_date,
        "recipient_count": int(recipient_count),
        "whispers_per_recipient": int(whispers_per_recipient),
        "candidates": candidates,
    }


def choose_weekly_reward_recipients(conn, user_id: int, campaign_id: int, recipient_user_ids: list[int]):
    start_row = conn.execute(
        "SELECT start_date FROM campaigns WHERE id = %s",
        (campaign_id,),
    ).fetchone()
    cycle_start_date = start_row[0] if start_row else None
    if not cycle_start_date:
        raise HTTPException(status_code=404, detail="Campaign not found")

    reward_row = conn.execute(
        """
        SELECT winner_user_id, recipient_count, whispers_per_recipient, fulfilled
        FROM campaign_cycle_rewards
        WHERE campaign_id = %s AND cycle_start_date = %s
        """,
        (campaign_id, cycle_start_date),
    ).fetchone()

    if not reward_row:
        raise HTTPException(status_code=404, detail="No pending weekly reward for this cycle")

    winner_user_id, recipient_count, whispers_per_recipient, fulfilled = reward_row
    if bool(fulfilled):
        raise HTTPException(status_code=400, detail="Weekly reward already fulfilled")
    if winner_user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the weekly winner can choose recipients")

    ids = [int(x) for x in (recipient_user_ids or [])]
    ids = list(dict.fromkeys(ids))  # de-dupe, preserve order

    if user_id in ids:
        raise HTTPException(status_code=400, detail="Winner cannot select themselves")
    if len(ids) != int(recipient_count):
        raise HTTPException(status_code=400, detail=f"You must choose exactly {int(recipient_count)} recipients")

    # Validate membership
    member_rows = conn.execute(
        "SELECT user_id FROM campaign_members WHERE campaign_id = %s",
        (campaign_id,),
    ).fetchall()
    members = {r[0] for r in member_rows}
    if any(uid not in members for uid in ids):
        raise HTTPException(status_code=400, detail="One or more recipients are not in this campaign")

    conn.execute("BEGIN")

    # Persist recipients
    for rid in ids:
        conn.execute(
            """
            INSERT INTO campaign_cycle_reward_recipients (campaign_id, cycle_start_date, recipient_user_id)
            VALUES (%s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (campaign_id, cycle_start_date, rid),
        )

    # Grant items
    for rid in ids:
        conn.execute(
            """
            INSERT INTO campaign_user_items (user_id, campaign_id, item_key, quantity)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, campaign_id, item_key)
            DO UPDATE SET quantity = campaign_user_items.quantity + EXCLUDED.quantity
            """,
            (rid, campaign_id, ORACLE_WHISPER_KEY, int(whispers_per_recipient)),
        )

    # Mark fulfilled
    conn.execute(
        """
        UPDATE campaign_cycle_rewards
        SET fulfilled = TRUE,
            fulfilled_at = CURRENT_TIMESTAMP
        WHERE campaign_id = %s AND cycle_start_date = %s
        """,
        (campaign_id, cycle_start_date),
    )

    conn.execute("COMMIT")

    return {
        "status": "ok",
        "cycle_start_date": cycle_start_date,
        "granted": {
            "recipient_count": int(recipient_count),
            "whispers_per_recipient": int(whispers_per_recipient),
            "item_key": ORACLE_WHISPER_KEY,
        },
    }
