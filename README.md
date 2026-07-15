# Web Portal

Standalone React + Tailwind file upload portal with direct browser uploads to AWS S3 and a Cloudflare Worker that issues presigned URLs.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS
- Cloudflare Worker signer
- Direct browser `PUT` uploads to private S3 objects

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm worker:dev
```

## Required Worker Secrets

Set these in Cloudflare:

```bash
wrangler secret put AWS_ACCESS_KEY_ID
wrangler secret put AWS_SECRET_ACCESS_KEY
```

And set these vars in `wrangler.toml` or your Cloudflare environment:

- `AWS_REGION`
- `S3_BUCKET_NAME`
- `S3_KEY_PREFIX`
- `MAX_FILE_SIZE_BYTES`
- `PRESIGN_TTL_SECONDS`
- `ALLOWED_MIME_TYPES`
- `ALLOWED_ORIGINS`

## Frontend Env

Create `.env.local` if needed:

```bash
VITE_UPLOAD_SIGNER_URL=http://127.0.0.1:8787
VITE_MAX_FILE_SIZE_BYTES=26214400
VITE_LAMBDA_UPLOAD_URL=https://66kwjqserfubt3a2c6voixso5a0yrtpk.lambda-url.ap-southeast-1.on.aws
VITE_LAMBDA_MAX_FILE_SIZE_BYTES=4500000
```

`VITE_UPLOAD_SIGNER_URL` powers the existing direct-to-S3 presigned upload module.
`VITE_LAMBDA_UPLOAD_URL` powers the small-file Lambda upload module. Use the
base Function URL only; the app posts directly to that URL.

## S3 CORS

Use bucket CORS that allows your portal origins to `PUT` objects:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "HEAD"],
    "AllowedOrigins": [
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "http://127.0.0.1:8080",
      "http://localhost:8080",
      "https://your-production-domain.example"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Deployment Shape

- Static assets: S3 + Cloudflare
- API signer: Cloudflare Worker mounted on `/api/*`
- Uploaded objects: private S3 bucket objects under `uploads/YYYY/MM/DD/...`

## Lambda Upload Module

The app also includes a small-file Lambda upload path. The browser sends one raw
file body to a Lambda Function URL, and Lambda writes the object to private S3
with its execution role. This path is intentionally capped at about 4.5 MB to
stay below Lambda synchronous request payload limits.

The complete Python Lambda source is in `lambda/lambda_function.py`.

### 1. Create Or Update The Lambda

Use these Lambda settings:

- Runtime: Python 3.14, or Python 3.12+ if 3.14 is not available in your AWS account.
- Handler: `lambda_function.lambda_handler`
- Architecture: `x86_64`, unless your AWS environment standardizes on `arm64`.

### 2. Package The Python Code

From the repository root:

```powershell
Set-Location lambda
Remove-Item -Recurse -Force build, lambda-upload-python.zip -ErrorAction SilentlyContinue
python -m pip install -r requirements.txt -t build
Copy-Item lambda_function.py build\
Compress-Archive -Path build\* -DestinationPath lambda-upload-python.zip -Force
```

Upload `lambda/lambda-upload-python.zip` to the Lambda function. Re-upload this
zip every time `lambda/lambda_function.py` changes.

### 3. Set Lambda Environment Variables

```bash
BUCKET_NAME=rccglobe-demo-webapp
S3_KEY_PREFIX=lambda
MAX_FILE_SIZE_BYTES=4500000
ALLOWED_MIME_TYPES=application/pdf,image/jpeg,image/png,image/webp,text/plain,application/zip,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

### 4. Give Lambda Permission To Write To S3

Attach this minimum permission to the Lambda execution role:

```json
{
  "Effect": "Allow",
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::rccglobe-demo-webapp/lambda/*"
}
```

### 5. Create The Lambda Function URL

Create a Function URL with:

- Auth type: `NONE`
- Allowed methods: `POST`, `OPTIONS`
- Allowed origins:
  - `http://127.0.0.1:5174`
  - `http://localhost:5174`
  - your production portal origin
- Allowed headers:
  - `content-type`
  - `x-file-name`
  - `x-file-size`
  - `x-upload-id`

Configure CORS on the Function URL only. Do not also add
`Access-Control-Allow-Origin` from the Lambda code, because duplicate origin
headers make browsers reject the response.

The development server proxies Lambda uploads through `/lambda-upload`, so a
local browser request does not require Function URL CORS. Production browser
uploads still require the Function URL CORS configuration above. Add every
production portal origin that serves this app; origins must match exactly.

Use the generated Function URL as `VITE_LAMBDA_UPLOAD_URL`.

### 6. Configure The Frontend

Create or update `.env.local`:

```env
VITE_LAMBDA_UPLOAD_URL=https://66kwjqserfubt3a2c6voixso5a0yrtpk.lambda-url.ap-southeast-1.on.aws
VITE_LAMBDA_MAX_FILE_SIZE_BYTES=4500000
```

### 7. Validate The Flow

Run local checks:

```bash
python -m py_compile lambda/lambda_function.py
pnpm test
pnpm build
pnpm dev
```

Open `http://127.0.0.1:3000`, choose the `Lambda Upload` tab, and test one small
allowed file. The uploaded object should appear under
`s3://rccglobe-demo-webapp/lambda/`.
