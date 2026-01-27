from io import BytesIO

from fastapi import HTTPException
from PIL import Image, ImageOps

from app.media.storage import (
    create_presigned_upload,
    validate_key_prefix,
    create_presigned_download,
    get_object_bytes,
    put_object_bytes,
)
from app.crud import get_db


def _thumb_key(original_key: str) -> str:
    parts = original_key.split("/")
    filename = parts[-1]
    base = filename.rsplit(".", 1)[0]
    return "/".join(parts[:-1] + ["thumbs", f"{base}.webp"])


def _build_thumbnail(data: bytes, size: int = 256) -> bytes:
    with Image.open(BytesIO(data)) as img:
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        thumb = ImageOps.fit(img, (size, size), Image.LANCZOS)
        out = BytesIO()
        thumb.save(out, format="WEBP", quality=82, method=6)
        return out.getvalue()


def _require_campaign_member(conn, campaign_id: int, user_id: int) -> None:
    member = conn.execute(
        "SELECT 1 FROM campaign_members WHERE campaign_id = %s AND user_id = %s",
        (campaign_id, user_id)
    ).fetchone()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this campaign")

def _require_campaign_ruler(conn, campaign_id: int, user_id: int) -> None:
    row = conn.execute(
        """
        SELECT ruler_id, COALESCE(is_admin_campaign, FALSE)
        FROM campaigns
        WHERE id = %s
        """,
        (campaign_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    ruler_id, is_admin_campaign = row
    if is_admin_campaign:
        raise HTTPException(status_code=403, detail="Admin campaigns cannot set a ruler background")
    is_admin = conn.execute(
        "SELECT COALESCE(is_admin, FALSE) FROM users WHERE id = %s",
        (user_id,)
    ).fetchone()
    is_admin = bool(is_admin[0]) if is_admin else False
    if not is_admin and (not ruler_id or ruler_id != user_id):
        raise HTTPException(status_code=403, detail="Only the current ruler can set the background")


def create_profile_image_upload(user_id: int, filename: str, content_type: str):
    key, file_url, upload_url, cache_control = create_presigned_upload(
        f"profiles/{user_id}",
        filename,
        content_type
    )
    return {"key": key, "file_url": file_url, "upload_url": upload_url, "cache_control": cache_control}


def confirm_profile_image_upload(user_id: int, key: str, file_url: str):
    validate_key_prefix(key, f"profiles/{user_id}")
    thumb_key = None
    thumb_url = None
    try:
        thumb_key = _thumb_key(key)
        original_bytes, _ = get_object_bytes(key)
        thumb_bytes = _build_thumbnail(original_bytes)
        thumb_url = put_object_bytes(
            thumb_key,
            thumb_bytes,
            "image/webp",
        )
    except Exception:
        thumb_key = None
        thumb_url = None
    with get_db() as conn:
        conn.execute(
            """
            UPDATE users
            SET profile_image_url = %s,
                profile_image_key = %s,
                profile_image_thumb_url = %s,
                profile_image_thumb_key = %s
            WHERE id = %s
            """,
            (file_url, key, thumb_url, thumb_key, user_id)
        )
    signed_url = create_presigned_download(key)
    thumb_signed_url = create_presigned_download(thumb_key) if thumb_key else None
    return {"profile_image_url": signed_url, "profile_image_thumb_url": thumb_signed_url}


def create_army_image_upload(user_id: int, campaign_id: int, filename: str, content_type: str):
    with get_db() as conn:
        _require_campaign_member(conn, campaign_id, user_id)
    key, file_url, upload_url, cache_control = create_presigned_upload(
        f"armies/{campaign_id}/{user_id}",
        filename,
        content_type
    )
    return {"key": key, "file_url": file_url, "upload_url": upload_url, "cache_control": cache_control}


def confirm_army_image_upload(user_id: int, campaign_id: int, key: str, file_url: str):
    validate_key_prefix(key, f"armies/{campaign_id}/{user_id}")
    thumb_key = None
    thumb_url = None
    try:
        thumb_key = _thumb_key(key)
        original_bytes, _ = get_object_bytes(key)
        thumb_bytes = _build_thumbnail(original_bytes)
        thumb_url = put_object_bytes(
            thumb_key,
            thumb_bytes,
            "image/webp",
        )
    except Exception:
        thumb_key = None
        thumb_url = None
    with get_db() as conn:
        _require_campaign_member(conn, campaign_id, user_id)
        conn.execute(
            """
            UPDATE campaign_members
            SET army_image_url = %s,
                army_image_key = %s,
                army_image_thumb_url = %s,
                army_image_thumb_key = %s
            WHERE campaign_id = %s AND user_id = %s
            """,
            (file_url, key, thumb_url, thumb_key, campaign_id, user_id)
        )
    signed_url = create_presigned_download(key)
    thumb_signed_url = create_presigned_download(thumb_key) if thumb_key else None
    return {"army_image_url": signed_url, "army_image_thumb_url": thumb_signed_url}


def create_ruler_background_upload(user_id: int, campaign_id: int, filename: str, content_type: str):
    with get_db() as conn:
        _require_campaign_member(conn, campaign_id, user_id)
        _require_campaign_ruler(conn, campaign_id, user_id)
    key, file_url, upload_url, cache_control = create_presigned_upload(
        f"rulers/{campaign_id}/{user_id}",
        filename,
        content_type
    )
    return {"key": key, "file_url": file_url, "upload_url": upload_url, "cache_control": cache_control}


def confirm_ruler_background_upload(user_id: int, campaign_id: int, key: str, file_url: str):
    validate_key_prefix(key, f"rulers/{campaign_id}/{user_id}")
    with get_db() as conn:
        _require_campaign_member(conn, campaign_id, user_id)
        _require_campaign_ruler(conn, campaign_id, user_id)
        conn.execute(
            """
            UPDATE campaigns
            SET ruler_background_image_url = %s,
                ruler_background_image_key = %s
            WHERE id = %s
            """,
            (file_url, key, campaign_id)
        )
    signed_url = create_presigned_download(key)
    return {"image_url": signed_url}


def clear_ruler_background(user_id: int, campaign_id: int):
    with get_db() as conn:
        _require_campaign_member(conn, campaign_id, user_id)
        _require_campaign_ruler(conn, campaign_id, user_id)
        conn.execute(
            """
            UPDATE campaigns
            SET ruler_background_image_url = NULL,
                ruler_background_image_key = NULL
            WHERE id = %s
            """,
            (campaign_id,)
        )
    return {"status": "cleared"}
