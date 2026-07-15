import base64
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import unquote

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client("s3")

BUCKET_NAME = os.environ.get("BUCKET_NAME")
S3_KEY_PREFIX = os.environ.get("S3_KEY_PREFIX", "lambda")
MAX_FILE_SIZE_BYTES = int(os.environ.get("MAX_FILE_SIZE_BYTES", "4500000"))
ALLOWED_MIME_TYPES = {
    value.strip()
    for value in os.environ.get(
        "ALLOWED_MIME_TYPES",
        ",".join(
            [
                "application/pdf",
                "image/jpeg",
                "image/png",
                "image/webp",
                "text/plain",
                "application/zip",
                "application/msword",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ]
        ),
    ).split(",")
    if value.strip()
}
def json_response(status_code, data, event=None):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": json.dumps(data),
    }


def empty_response(status_code, event):
    return {
        "statusCode": status_code,
        "body": "",
    }


def get_header(headers, name):
    if not headers:
        return None

    wanted = name.lower()
    for key, value in headers.items():
        if key.lower() == wanted:
            return value

    return None


def sanitize_name(name):
    clean = re.sub(r"[^a-zA-Z0-9._-]+", "-", name)
    clean = re.sub(r"-+", "-", clean).strip("-")
    return clean or "upload.bin"


def decode_file_name(value):
    if not value:
        return ""

    try:
        return unquote(value)
    except Exception:
        return value


def create_object_key(file_name):
    prefix = S3_KEY_PREFIX.strip("/")
    return f"{prefix}/{uuid.uuid4()}-{sanitize_name(file_name)}"


def get_body_bytes(event):
    body = event.get("body")
    if not body:
        return b""

    if event.get("isBase64Encoded"):
        return base64.b64decode(body)

    return body.encode("utf-8")


def get_http_method(event):
    return (
        event.get("requestContext", {})
        .get("http", {})
        .get("method", "")
        .upper()
    )


def lambda_handler(event, context):
    logger.info(
        "@@# Lambda upload event received: request_id=%s raw_path=%s is_base64=%s",
        event.get("requestContext", {}).get("requestId"),
        event.get("rawPath"),
        event.get("isBase64Encoded"),
    )

    method = get_http_method(event)
    if method == "OPTIONS":
        return empty_response(204, event)

    if method != "POST":
        return json_response(405, {"error": "Method not allowed."}, event)

    if not BUCKET_NAME:
        return json_response(500, {"error": "BUCKET_NAME is not configured."}, event)

    headers = event.get("headers") or {}
    content_type = get_header(headers, "content-type") or "application/octet-stream"
    encoded_file_name = get_header(headers, "x-file-name")
    upload_id = get_header(headers, "x-upload-id") or str(uuid.uuid4())
    declared_size_header = get_header(headers, "x-file-size") or "0"
    file_name = decode_file_name(encoded_file_name)

    try:
        declared_size = int(declared_size_header)
    except ValueError:
        return json_response(400, {"error": "X-File-Size must be a number."}, event)

    try:
        body = get_body_bytes(event)
    except Exception:
        return json_response(400, {"error": "Could not decode request body."}, event)

    if not file_name.strip():
        return json_response(400, {"error": "X-File-Name header is required."}, event)

    if len(body) <= 0:
        return json_response(400, {"error": "File body is required."}, event)

    if len(body) > MAX_FILE_SIZE_BYTES:
        limit_mb = round(MAX_FILE_SIZE_BYTES / 1024 / 1024)
        return json_response(
            413,
            {"error": f"File exceeds {limit_mb} MB Lambda upload limit."},
            event,
        )

    if declared_size > 0 and declared_size != len(body):
        return json_response(
            400,
            {"error": "Declared file size does not match uploaded body size."},
            event,
        )

    if content_type not in ALLOWED_MIME_TYPES:
        return json_response(
            415,
            {"error": f"MIME type {content_type or 'unknown'} is not allowed."},
            event,
        )

    object_key = create_object_key(file_name)
    uploaded_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    try:
        result = s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=object_key,
            Body=body,
            ContentType=content_type,
            Metadata={
                "original-filename": sanitize_name(file_name),
                "upload-id": upload_id,
            },
        )
    except (BotoCoreError, ClientError):
        logger.exception("@@# Lambda upload failed")
        return json_response(500, {"error": "Could not upload file to S3."}, event)

    etag = result.get("ETag")
    logger.info(
        "@@# Lambda upload complete: bucket=%s object_key=%s size=%s content_type=%s etag=%s",
        BUCKET_NAME,
        object_key,
        len(body),
        content_type,
        etag,
    )

    return json_response(
        200,
        {
            "upload": {
                "id": upload_id,
                "bucket": BUCKET_NAME,
                "objectKey": object_key,
                "size": len(body),
                "contentType": content_type,
                "etag": etag,
                "uploadedAt": uploaded_at,
            }
        },
        event,
    )
