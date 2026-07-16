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
DIRECT_S3_KEY_PREFIX = os.environ.get("DIRECT_S3_KEY_PREFIX", "uploads")
MAX_FILE_SIZE_BYTES = int(os.environ.get("MAX_FILE_SIZE_BYTES", "4500000"))
DIRECT_MAX_FILE_SIZE_BYTES = int(os.environ.get("DIRECT_MAX_FILE_SIZE_BYTES", "26214400"))
PRESIGN_TTL_SECONDS = int(os.environ.get("PRESIGN_TTL_SECONDS", "900"))
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


def json_response(status_code, data):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(data),
    }


def empty_response(status_code):
    return {"statusCode": status_code, "body": ""}


def get_header(headers, name):
    wanted = name.lower()
    for key, value in (headers or {}).items():
        if key.lower() == wanted:
            return value
    return None


def sanitize_name(name):
    clean = re.sub(r"[^a-zA-Z0-9._-]+", "-", name or "")
    clean = re.sub(r"-+", "-", clean).strip("-")
    return clean or "upload.bin"


def decode_file_name(value):
    try:
        return unquote(value or "")
    except Exception:
        return value or ""


def get_body_bytes(event):
    body = event.get("body")
    if not body:
        return b""
    if event.get("isBase64Encoded"):
        return base64.b64decode(body)
    return body.encode("utf-8")


def get_json_body(event):
    try:
        raw_body = get_body_bytes(event)
        return json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return None


def get_http_method(event):
    return event.get("requestContext", {}).get("http", {}).get("method", "").upper()


def get_path(event):
    return event.get("rawPath") or event.get("requestContext", {}).get("http", {}).get("path", "") or "/"


def require_bucket():
    if not BUCKET_NAME:
        return json_response(500, {"error": "BUCKET_NAME is not configured."})
    return None


def create_lambda_object_key(file_name):
    return f"{S3_KEY_PREFIX.strip('/')}/{uuid.uuid4()}-{sanitize_name(file_name)}"


def create_direct_object_key(file_name):
    now = datetime.now(timezone.utc)
    prefix = DIRECT_S3_KEY_PREFIX.strip("/") or "uploads"
    return f"{prefix}/{now:%Y/%m/%d}/{uuid.uuid4()}/{uuid.uuid4()}-{sanitize_name(file_name)}"


def validate_direct_candidate(candidate):
    name = candidate.get("name") if isinstance(candidate, dict) else None
    file_type = candidate.get("type") if isinstance(candidate, dict) else None
    size = candidate.get("size") if isinstance(candidate, dict) else None
    if not isinstance(name, str) or not name.strip():
        return "File name is required."
    if not isinstance(file_type, str) or file_type not in ALLOWED_MIME_TYPES:
        return "File type is not allowed for this portal."
    if not isinstance(size, int) or size <= 0:
        return "File size must be a positive number."
    if size > DIRECT_MAX_FILE_SIZE_BYTES:
        return f"Exceeds {round(DIRECT_MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB limit."
    return None


def handle_presign(event):
    bucket_error = require_bucket()
    if bucket_error:
        return bucket_error

    payload = get_json_body(event)
    files = payload.get("files") if isinstance(payload, dict) else None
    if not isinstance(files, list) or not files:
        return json_response(400, {"error": "At least one file is required."})

    uploads = []
    rejected = []
    for candidate in files:
        reason = validate_direct_candidate(candidate)
        name = candidate.get("name", "upload.bin") if isinstance(candidate, dict) else "upload.bin"
        if reason:
            rejected.append({"name": name, "reason": reason})
            continue

        object_key = create_direct_object_key(name)
        try:
            upload_url = s3_client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": BUCKET_NAME,
                    "Key": object_key,
                    "ContentType": candidate["type"],
                },
                ExpiresIn=PRESIGN_TTL_SECONDS,
                HttpMethod="PUT",
            )
        except (BotoCoreError, ClientError):
            logger.exception("Could not generate a direct S3 presign URL")
            return json_response(500, {"error": "Could not create upload URLs."})

        uploads.append(
            {
                "id": candidate.get("id") or str(uuid.uuid4()),
                "objectKey": object_key,
                "uploadUrl": upload_url,
                "method": "PUT",
                "headers": {"Content-Type": candidate["type"]},
                "expiresAt": datetime.fromtimestamp(
                    datetime.now(timezone.utc).timestamp() + PRESIGN_TTL_SECONDS,
                    tz=timezone.utc,
                ).isoformat().replace("+00:00", "Z"),
            }
        )

    response = {"uploads": uploads}
    if rejected:
        response["rejected"] = rejected
    return json_response(200, response)


def handle_lambda_upload(event):
    bucket_error = require_bucket()
    if bucket_error:
        return bucket_error

    headers = event.get("headers") or {}
    content_type = get_header(headers, "content-type") or "application/octet-stream"
    file_name = decode_file_name(get_header(headers, "x-file-name"))
    upload_id = get_header(headers, "x-upload-id") or str(uuid.uuid4())
    declared_size_header = get_header(headers, "x-file-size") or "0"

    try:
        declared_size = int(declared_size_header)
        body = get_body_bytes(event)
    except (ValueError, TypeError):
        return json_response(400, {"error": "Could not read the upload body."})

    if not file_name.strip():
        return json_response(400, {"error": "X-File-Name header is required."})
    if not body:
        return json_response(400, {"error": "File body is required."})
    if len(body) > MAX_FILE_SIZE_BYTES:
        return json_response(413, {"error": f"File exceeds {round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB Lambda upload limit."})
    if declared_size > 0 and declared_size != len(body):
        return json_response(400, {"error": "Declared file size does not match uploaded body size."})
    if content_type not in ALLOWED_MIME_TYPES:
        return json_response(415, {"error": f"MIME type {content_type or 'unknown'} is not allowed."})

    object_key = create_lambda_object_key(file_name)
    uploaded_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    try:
        result = s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=object_key,
            Body=body,
            ContentType=content_type,
            Metadata={"original-filename": sanitize_name(file_name), "upload-id": upload_id},
        )
    except (BotoCoreError, ClientError):
        logger.exception("Lambda upload failed")
        return json_response(500, {"error": "Could not upload file to S3."})

    return json_response(
        200,
        {
            "upload": {
                "id": upload_id,
                "bucket": BUCKET_NAME,
                "objectKey": object_key,
                "size": len(body),
                "contentType": content_type,
                "etag": result.get("ETag"),
                "uploadedAt": uploaded_at,
            }
        },
    )


def lambda_handler(event, context):
    method = get_http_method(event)
    path = get_path(event)
    if method == "OPTIONS":
        return empty_response(204)
    if method != "POST":
        return json_response(405, {"error": "Method not allowed."})
    if path.rstrip("/").endswith("/presign"):
        return handle_presign(event)
    return handle_lambda_upload(event)
