from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.crud import handle_campaign_end, get_db
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import asyncio

from db import get_pool

pool = get_pool()

async def check_connections():
    while True:
        await asyncio.sleep(600)
        print("check connections")
        pool.check()

def reset_expired_campaigns():
    print(f"[{datetime.now(ZoneInfo('America/Chicago'))}] Checking for expired campaigns...")

    today = datetime.now(ZoneInfo("America/Chicago")).date()

    with get_db() as conn:
        campaigns = conn.execute("""
            SELECT id, start_date, cycle_length
            FROM campaigns
        """).fetchall()

        for camp_id, start_date_str, cycle_length in campaigns:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            final_day = start_date + timedelta(days=cycle_length - 1)

            if today > final_day:
                print(f"  🔁 Resetting campaign {camp_id} — ended on {final_day}")
                handle_campaign_end(camp_id)

def start_scheduler():
    scheduler = BackgroundScheduler()
    
    # Change to run every 1 minute for testing
    scheduler.add_job(reset_expired_campaigns, CronTrigger(hour=0, minute=5, timezone="America/Chicago"))

    scheduler.start()
