# campaign_reset_cron.py

from app.crud import handle_campaign_end, get_db
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo

def reset_expired_campaigns():
    today = datetime.now(ZoneInfo("UTC")).date()

    conn = get_db()
    campaigns = conn.execute("""
            SELECT id, start_date, cycle_length
            FROM campaigns
        """).fetchall()
    conn.close()

    for camp_id, start_date_value, cycle_length in campaigns:
            if isinstance(start_date_value, datetime):
                start_date = start_date_value.date()
            elif isinstance(start_date_value, date):
                start_date = start_date_value
            else:
                try:
                    start_date = datetime.fromisoformat(start_date_value).date()
                except ValueError:
                    start_date = datetime.strptime(start_date_value, "%Y-%m-%d").date()

            final_day = start_date + timedelta(days=cycle_length - 1)

            if today > final_day:
                print(f"Resetting campaign {camp_id} — ended on {final_day}")
                handle_campaign_end(camp_id)

if __name__ == "__main__":
    reset_expired_campaigns()
