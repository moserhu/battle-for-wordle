import json
from fastapi import HTTPException
from app.crud import get_db, is_admin_user

def _require_admin(conn, user_id: int):
    if not is_admin_user(conn, user_id):
        raise HTTPException(status_code=403, detail="Admin privileges required")

def list_update_logs():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT id, date, title, items
            FROM update_logs
            ORDER BY date DESC, id DESC
        """).fetchall()

    logs = []
    for row in rows:
        items = row[3]
        if isinstance(items, str):
            try:
                items = json.loads(items)
            except json.JSONDecodeError:
                items = []
        logs.append({
            "id": row[0],
            "date": row[1],
            "title": row[2],
            "items": items if isinstance(items, list) else []
        })
    return logs

def create_update_log(user_id: int, date: str, title: str, items: list[str]):
    with get_db() as conn:
        _require_admin(conn, user_id)
        row = conn.execute("""
            INSERT INTO update_logs (date, title, items)
            VALUES (%s, %s, %s)
            RETURNING id
        """, (date, title, json.dumps(items))).fetchone()

    return {"id": row[0]}

def update_update_log(user_id: int, log_id: int, date: str | None, title: str | None, items: list[str] | None):
    with get_db() as conn:
        _require_admin(conn, user_id)
        existing = conn.execute("""
            SELECT date, title, items
            FROM update_logs
            WHERE id = %s
        """, (log_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Update log not found")

        next_date = date if date is not None else existing[0]
        next_title = title if title is not None else existing[1]
        next_items = items if items is not None else existing[2]
        if isinstance(next_items, str):
            try:
                next_items = json.loads(next_items)
            except json.JSONDecodeError:
                next_items = []

        conn.execute("""
            UPDATE update_logs
            SET date = %s,
                title = %s,
                items = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (next_date, next_title, json.dumps(next_items), log_id))

    return {"status": "updated"}

def delete_update_log(user_id: int, log_id: int):
    with get_db() as conn:
        _require_admin(conn, user_id)
        result = conn.execute("""
            DELETE FROM update_logs
            WHERE id = %s
        """, (log_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Update log not found")

    return {"status": "deleted"}
