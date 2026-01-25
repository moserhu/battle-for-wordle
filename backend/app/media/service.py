from fastapi import HTTPException

from app.media.storage import create_presigned_upload, validate_key_prefix, create_presigned_download
from app.crud import get_db


def _require_campaign_member(conn, campaign_id: int, user_id: int) -> None:
    member = conn.execute(
        "SELECT 1 FROM campaign_members WHERE campaign_id = %s AND user_id = %s",
        (campaign_id, user_id)
    ).fetchone()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this campaign")


def create_profile_image_upload(user_id: int, filename: str, content_type: str):
    key, file_url, upload_url = create_presigned_upload(
        f"profiles/{user_id}",
        filename,
        content_type
    )
    return {"key": key, "file_url": file_url, "upload_url": upload_url}


def confirm_profile_image_upload(user_id: int, key: str, file_url: str):
    validate_key_prefix(key, f"profiles/{user_id}")
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET profile_image_url = %s, profile_image_key = %s WHERE id = %s",
            (file_url, key, user_id)
        )
    signed_url = create_presigned_download(key)
    return {"profile_image_url": signed_url}


def create_army_image_upload(user_id: int, campaign_id: int, filename: str, content_type: str):
    with get_db() as conn:
        _require_campaign_member(conn, campaign_id, user_id)
    key, file_url, upload_url = create_presigned_upload(
        f"armies/{campaign_id}/{user_id}",
        filename,
        content_type
    )
    return {"key": key, "file_url": file_url, "upload_url": upload_url}


def confirm_army_image_upload(user_id: int, campaign_id: int, key: str, file_url: str):
    validate_key_prefix(key, f"armies/{campaign_id}/{user_id}")
    with get_db() as conn:
        _require_campaign_member(conn, campaign_id, user_id)
        conn.execute(
            """
            UPDATE campaign_members
            SET army_image_url = %s, army_image_key = %s
            WHERE campaign_id = %s AND user_id = %s
            """,
            (file_url, key, campaign_id, user_id)
        )
    signed_url = create_presigned_download(key)
    return {"army_image_url": signed_url}
