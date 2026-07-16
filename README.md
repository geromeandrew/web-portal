# Web Portal

React + Tailwind upload portal with two AWS-backed upload modes:

- **Direct S3**: the Lambda Function URL creates short-lived S3 `PUT` URLs; the browser uploads files directly to private S3.
- **Lambda upload**: the browser sends one small file to the Lambda Function URL, which writes it to private S3.

No separate edge signing service is required.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

## Frontend configuration

Create `.env.local`:

```env
VITE_LAMBDA_UPLOAD_URL=https://your-function-id.lambda-url.ap-southeast-1.on.aws
VITE_UPLOAD_TRANSPORT=direct
VITE_MAX_FILE_SIZE_BYTES=26214400
VITE_LAMBDA_MAX_FILE_SIZE_BYTES=4500000
```

`VITE_LAMBDA_UPLOAD_URL` is required for both modes. During development, Vite proxies it through `/lambda-upload`; production requests go straight to the Function URL. Optionally set `VITE_DIRECT_UPLOAD_URL` when the presigning endpoint uses a different Function URL.

## Lambda configuration

Deploy `lambda/lambda_function.py` with handler `lambda_function.lambda_handler`. The endpoint accepts:

- `POST /presign` for Direct S3 presigned `PUT` URLs.
- `POST /` for Lambda upload mode.

Set these Lambda environment variables:

```env
BUCKET_NAME=your-private-bucket
S3_KEY_PREFIX=lambda
DIRECT_S3_KEY_PREFIX=uploads
MAX_FILE_SIZE_BYTES=4500000
DIRECT_MAX_FILE_SIZE_BYTES=26214400
PRESIGN_TTL_SECONDS=900
ALLOWED_MIME_TYPES=application/pdf,image/jpeg,image/png,image/webp,text/plain,application/zip,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

Give the Lambda execution role `s3:PutObject` permission for both configured prefixes. The same permission allows boto3 to create presigned upload URLs.

```json
{
  "Effect": "Allow",
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::your-private-bucket/*"
}
```

Configure Function URL CORS for `POST` and `OPTIONS`, your portal origins, and these headers:

```text
content-type, x-file-name, x-file-size, x-upload-id
```

## S3 CORS

Allow the browser to upload directly to S3:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "HEAD"],
    "AllowedOrigins": [
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "https://your-production-domain.example"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Validate

```bash
python -m py_compile lambda/lambda_function.py
pnpm test
pnpm build
```

For Direct S3, select **Direct S3** in the header and upload an allowed file. The browser first requests `/presign` from Lambda, then sends the file directly to S3. For Lambda upload, select **Lambda upload** and upload one allowed file under the Lambda size limit.
