# campaign_reset_cron.py

from app.crud import handle_campaign_end, get_db
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

def reset_expired_campaigns():
    today = datetime.now(ZoneInfo("America/Chicago")).date()

    conn = get_db()
    campaigns = conn.execute("""
            SELECT id, start_date, cycle_length
            FROM campaigns
        """).fetchall()
    conn.close()

    for camp_id, start_date_str, cycle_length in campaigns:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            final_day = start_date + timedelta(days=cycle_length - 1)

            if today > final_day:
                print(f"Resetting campaign {camp_id} — ended on {final_day}")
                handle_campaign_end(camp_id)

if __name__ == "__main__":
    reset_expired_campaigns()
