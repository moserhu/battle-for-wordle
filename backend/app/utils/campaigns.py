from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import HTTPException

def resolve_campaign_day(conn, campaign_id: int, day_override: int | None):
    row = conn.execute("""
        SELECT start_date, cycle_length
        FROM campaigns
        WHERE id = %s
    """, (campaign_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    start_date = datetime.strptime(row[0], "%Y-%m-%d").date()
    cycle_length = row[1]
    today = datetime.now(ZoneInfo("America/Chicago")).date()
    current_day = min((today - start_date).days + 1, cycle_length)

    if day_override is None:
        target_day = current_day
    else:
        if day_override < 1 or day_override > cycle_length:
            raise HTTPException(status_code=400, detail="Invalid campaign day")
        if day_override > current_day:
            raise HTTPException(status_code=403, detail="Future days are locked")
        target_day = day_override

    target_date = start_date + timedelta(days=target_day - 1)
    return start_date, cycle_length, current_day, target_day, target_date
