from datetime import datetime

from app.crud import get_db
from app.media.storage import get_object_bytes, put_object_bytes, create_presigned_download
from app.media.service import _thumb_key, _build_thumbnail


def backfill_profile_thumbs(limit: int | None = None):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, profile_image_key
            FROM users
            WHERE profile_image_key IS NOT NULL
              AND (profile_image_thumb_key IS NULL OR profile_image_thumb_key = '')
            """
        ).fetchall()

        if limit:
            rows = rows[:limit]

        for user_id, key in rows:
            try:
                thumb_key = _thumb_key(key)
                original_bytes, _ = get_object_bytes(key)
                thumb_bytes = _build_thumbnail(original_bytes)
                thumb_url = put_object_bytes(thumb_key, thumb_bytes, "image/webp")
                conn.execute(
                    """
                    UPDATE users
                    SET profile_image_thumb_url = %s,
                        profile_image_thumb_key = %s
                    WHERE id = %s
                    """,
                    (thumb_url, thumb_key, user_id),
                )
                print(f"[profile] user_id={user_id} ok -> {thumb_key}")
            except Exception as exc:
                print(f"[profile] user_id={user_id} failed: {exc}")


def backfill_army_thumbs(limit: int | None = None):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT campaign_id, user_id, army_image_key
            FROM campaign_members
            WHERE army_image_key IS NOT NULL
              AND (army_image_thumb_key IS NULL OR army_image_thumb_key = '')
            """
        ).fetchall()

        if limit:
            rows = rows[:limit]

        for campaign_id, user_id, key in rows:
            try:
                thumb_key = _thumb_key(key)
                original_bytes, _ = get_object_bytes(key)
                thumb_bytes = _build_thumbnail(original_bytes)
                thumb_url = put_object_bytes(thumb_key, thumb_bytes, "image/webp")
                conn.execute(
                    """
                    UPDATE campaign_members
                    SET army_image_thumb_url = %s,
                        army_image_thumb_key = %s
                    WHERE campaign_id = %s AND user_id = %s
                    """,
                    (thumb_url, thumb_key, campaign_id, user_id),
                )
                print(f"[army] campaign_id={campaign_id} user_id={user_id} ok -> {thumb_key}")
            except Exception as exc:
                print(f"[army] campaign_id={campaign_id} user_id={user_id} failed: {exc}")


if __name__ == "__main__":
    print(f"[thumb-backfill] start {datetime.utcnow().isoformat()}Z")
    backfill_profile_thumbs()
    backfill_army_thumbs()
    print(f"[thumb-backfill] done {datetime.utcnow().isoformat()}Z")
