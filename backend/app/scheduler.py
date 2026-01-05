from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.crud import handle_campaign_end, update_campaign_ruler, get_db
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
import json

def reset_expired_campaigns():
    print(f"[{datetime.now(ZoneInfo('America/Chicago'))}] Checking for expired campaigns...")

    today = datetime.now(ZoneInfo("America/Chicago")).date()

    with get_db() as conn:
        campaigns = conn.execute("""
            SELECT id, start_date, cycle_length
            FROM campaigns
        """).fetchall()

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
                print(f"  🔁 Resetting campaign {camp_id} — ended on {final_day}")
                handle_campaign_end(camp_id)

def update_final_day_rulers():
    print(f"[{datetime.now(ZoneInfo('America/Chicago'))}] Updating rulers for final-day campaigns...")

    today = datetime.now(ZoneInfo("America/Chicago")).date()

    with get_db() as conn:
        campaigns = conn.execute("""
            SELECT id, start_date, cycle_length
            FROM campaigns
        """).fetchall()

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

            if today == final_day:
                print(f"  👑 Updating ruler for campaign {camp_id} — final day {final_day}")
                update_campaign_ruler(camp_id)

def compute_campaign_daily_stats():
    print(f"[{datetime.now(ZoneInfo('America/Chicago'))}] Computing campaign daily stats...")

    today = datetime.now(ZoneInfo("America/Chicago")).date()
    stats_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")

    with get_db() as conn:
        campaign_ids = conn.execute("SELECT id FROM campaigns").fetchall()

        for (campaign_id,) in campaign_ids:
            member_count = conn.execute("""
                SELECT COUNT(*) FROM campaign_members WHERE campaign_id = %s
            """, (campaign_id,)).fetchone()[0]

            completed_count = conn.execute("""
                SELECT COUNT(*) FROM campaign_daily_progress
                WHERE campaign_id = %s AND date = %s AND completed = 1
            """, (campaign_id, stats_date)).fetchone()[0]

            troops_rows = conn.execute("""
                SELECT COALESCE(SUM(troops), 0), COALESCE(MAX(troops), 0)
                FROM campaign_daily_troops
                WHERE campaign_id = %s AND date = %s
            """, (campaign_id, stats_date)).fetchone()
            total_troops = troops_rows[0] or 0
            highest_troops = troops_rows[1] or 0
            avg_troops_per_player = (total_troops / member_count) if member_count else 0

            guess_rows = conn.execute("""
                SELECT user_id, current_row, results
                FROM campaign_guess_states
                WHERE campaign_id = %s AND date = %s
            """, (campaign_id, stats_date)).fetchall()

            dd_used_ids = conn.execute("""
                SELECT user_id
                FROM campaign_members
                WHERE campaign_id = %s AND double_down_date = %s
            """, (campaign_id, stats_date)).fetchall()
            dd_used_set = {row[0] for row in dd_used_ids}
            double_down_used = len(dd_used_set)

            fast_solve_count = 0
            clutch_wins = 0
            double_down_success = 0

            for user_id, current_row, results_json in guess_rows:
                if not results_json:
                    continue
                results = json.loads(results_json)
                solved = any(row and all(cell == "correct" for cell in row) for row in results)
                if not solved:
                    continue

                if current_row is not None and current_row <= 3:
                    fast_solve_count += 1

                if user_id in dd_used_set:
                    if current_row == 3:
                        clutch_wins += 1
                    if current_row is not None and current_row <= 3:
                        double_down_success += 1
                else:
                    if current_row == 6:
                        clutch_wins += 1

            word_rows = conn.execute("""
                SELECT word,
                       SUM(CASE WHEN solved = 1 THEN 1 ELSE 0 END) AS solved_count,
                       SUM(CASE WHEN solved = 0 THEN 1 ELSE 0 END) AS failed_count
                FROM campaign_user_daily_results
                WHERE campaign_id = %s AND date = %s AND word IS NOT NULL
                GROUP BY word
            """, (campaign_id, stats_date)).fetchall()

            hardest_word = None
            easiest_word = None
            hardest_rate = -1.0
            easiest_rate = -1.0

            for word, solved_count, failed_count in word_rows:
                attempts = (solved_count or 0) + (failed_count or 0)
                if attempts == 0:
                    continue
                fail_rate = (failed_count or 0) / attempts
                success_rate = (solved_count or 0) / attempts
                if fail_rate > hardest_rate:
                    hardest_rate = fail_rate
                    hardest_word = word
                if success_rate > easiest_rate:
                    easiest_rate = success_rate
                    easiest_word = word

            completion_rate = (completed_count / member_count) if member_count else 0
            participation_pct = completion_rate

            conn.execute("""
                INSERT INTO campaign_daily_stats (
                    campaign_id,
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
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (campaign_id, date) DO UPDATE
                SET total_troops = EXCLUDED.total_troops,
                    avg_troops_per_player = EXCLUDED.avg_troops_per_player,
                    highest_troops = EXCLUDED.highest_troops,
                    completed_count = EXCLUDED.completed_count,
                    member_count = EXCLUDED.member_count,
                    completion_rate = EXCLUDED.completion_rate,
                    fast_solve_count = EXCLUDED.fast_solve_count,
                    clutch_wins = EXCLUDED.clutch_wins,
                    double_down_used = EXCLUDED.double_down_used,
                    double_down_success = EXCLUDED.double_down_success,
                    participation_pct = EXCLUDED.participation_pct,
                    hardest_word = EXCLUDED.hardest_word,
                    easiest_word = EXCLUDED.easiest_word
            """, (
                campaign_id,
                stats_date,
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
            ))

def compute_campaign_daily_word_stats():
    print(f"[{datetime.now(ZoneInfo('America/Chicago'))}] Computing campaign daily word stats...")

    today = datetime.now(ZoneInfo("America/Chicago")).date()
    stats_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")

    with get_db() as conn:
        rows = conn.execute("""
            SELECT campaign_id, word,
                   SUM(CASE WHEN solved = 1 THEN 1 ELSE 0 END) AS solved_count,
                   SUM(CASE WHEN solved = 0 THEN 1 ELSE 0 END) AS failed_count
            FROM campaign_user_daily_results
            WHERE date = %s AND word IS NOT NULL
            GROUP BY campaign_id, word
        """, (stats_date,)).fetchall()

        for campaign_id, word, solved_count, failed_count in rows:
            conn.execute("""
                INSERT INTO campaign_daily_word_stats (
                    campaign_id,
                    date,
                    word,
                    solved_count,
                    failed_count
                ) VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (campaign_id, date, word) DO UPDATE
                SET solved_count = EXCLUDED.solved_count,
                    failed_count = EXCLUDED.failed_count
            """, (
                campaign_id,
                stats_date,
                word,
                solved_count or 0,
                failed_count or 0
            ))

def compute_global_daily_stats():
    print(f"[{datetime.now(ZoneInfo('America/Chicago'))}] Computing global daily stats...")

    today = datetime.now(ZoneInfo("America/Chicago")).date()
    stats_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")

    with get_db() as conn:
        total_guesses = conn.execute("""
            SELECT COUNT(*) FROM campaign_guesses WHERE date = %s
        """, (stats_date,)).fetchone()[0]

        total_players = conn.execute("""
            SELECT COUNT(DISTINCT user_id)
            FROM campaign_user_daily_results
            WHERE date = %s
        """, (stats_date,)).fetchone()[0]

        total_campaigns_completed = conn.execute("""
            SELECT COUNT(*)
            FROM campaign_daily_stats
            WHERE date = %s AND member_count > 0 AND completed_count = member_count
        """, (stats_date,)).fetchone()[0]

        guess_counts = conn.execute("""
            SELECT guesses_used, COUNT(*)
            FROM campaign_user_daily_results
            WHERE date = %s
            GROUP BY guesses_used
        """, (stats_date,)).fetchall()
        guess_map = {row[0]: row[1] for row in guess_counts}

        conn.execute("""
            INSERT INTO global_daily_stats (
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
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (date) DO UPDATE
            SET total_campaigns_completed = EXCLUDED.total_campaigns_completed,
                total_players = EXCLUDED.total_players,
                total_guesses = EXCLUDED.total_guesses,
                guess_1 = EXCLUDED.guess_1,
                guess_2 = EXCLUDED.guess_2,
                guess_3 = EXCLUDED.guess_3,
                guess_4 = EXCLUDED.guess_4,
                guess_5 = EXCLUDED.guess_5,
                guess_6 = EXCLUDED.guess_6
        """, (
            stats_date,
            total_campaigns_completed,
            total_players,
            total_guesses,
            guess_map.get(1, 0),
            guess_map.get(2, 0),
            guess_map.get(3, 0),
            guess_map.get(4, 0),
            guess_map.get(5, 0),
            guess_map.get(6, 0)
        ))

def start_scheduler():
    scheduler = BackgroundScheduler()
    
    # Change to run every 1 minute for testing
    scheduler.add_job(reset_expired_campaigns, CronTrigger(hour=0, minute=0, timezone="America/Chicago"))
    scheduler.add_job(compute_campaign_daily_stats, CronTrigger(hour=0, minute=5, timezone="America/Chicago"))
    scheduler.add_job(compute_campaign_daily_word_stats, CronTrigger(hour=0, minute=7, timezone="America/Chicago"))
    scheduler.add_job(compute_global_daily_stats, CronTrigger(hour=0, minute=10, timezone="America/Chicago"))
    scheduler.add_job(update_final_day_rulers, CronTrigger(hour=20, minute=0, timezone="America/Chicago"))

    scheduler.start()
