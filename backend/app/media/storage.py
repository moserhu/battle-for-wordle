import os
import uuid
from typing import Tuple

import boto3
from botocore.config import Config
from fastapi import HTTPException

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _get_s3_settings():
    endpoint_url = os.getenv("S3_ENDPOINT_URL")
    access_key = os.getenv("S3_ACCESS_KEY_ID") or os.getenv("S3_ACCESS_KEY")
    secret_key = os.getenv("S3_SECRET_ACCESS_KEY") or os.getenv("S3_SECRET_KEY")
    bucket = os.getenv("S3_BUCKET")
    region = os.getenv("S3_REGION", "us-east-1")
    public_base = os.getenv("S3_PUBLIC_BASE_URL")

    if not endpoint_url or not access_key or not secret_key or not bucket:
        raise RuntimeError("S3 configuration is incomplete")

    return endpoint_url, access_key, secret_key, bucket, region, public_base


def _get_s3_client():
    endpoint_url, access_key, secret_key, _, region, _ = _get_s3_settings()
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
        config=Config(signature_version="s3v4"),
    )


def _resolve_extension(filename: str, content_type: str) -> Tuple[str, str]:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext in {".jpeg"}:
        ext = ".jpg"

    if ext and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    if not ext:
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported image type")
        ext = ALLOWED_CONTENT_TYPES[content_type]

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    return ext, content_type


def create_presigned_upload(prefix: str, filename: str, content_type: str) -> tuple[str, str, str]:
    ext, content_type = _resolve_extension(filename, content_type)
    key = f"{prefix}/{uuid.uuid4().hex}{ext}"

    client = _get_s3_client()
    _, _, _, bucket, _, public_base = _get_s3_settings()

    upload_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=3600,
    )

    if public_base:
        file_url = f"{public_base.rstrip('/')}/{key}"
    else:
        endpoint_url, _, _, _, _, _ = _get_s3_settings()
        file_url = f"{endpoint_url.rstrip('/')}/{bucket}/{key}"

    return key, file_url, upload_url


def validate_key_prefix(key: str, expected_prefix: str) -> None:
    if not key or not key.startswith(f"{expected_prefix}/"):
        raise HTTPException(status_code=400, detail="Invalid upload key")


def create_presigned_download(key: str, expires_in: int = 3600) -> str:
    client = _get_s3_client()
    _, _, _, bucket, _, _ = _get_s3_settings()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )
