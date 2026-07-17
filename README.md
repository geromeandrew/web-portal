# Web Portal

React + Tailwind upload portal using AWS Lambda to store files in private S3. Lambda upload is the only available transfer method.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

## Frontend configuration

Create `.env.local` from `.env.example`:

```env
VITE_LAMBDA_UPLOAD_URL=https://your-function-id.lambda-url.ap-southeast-1.on.aws
VITE_LAMBDA_MAX_FILE_SIZE_BYTES=4500000
```

## Lambda configuration

Deploy `lambda/lambda_function.py` with handler `lambda_function.lambda_handler`. It accepts `POST /` uploads and writes them to private S3.

```env
BUCKET_NAME=your-private-bucket
S3_KEY_PREFIX=lambda
MAX_FILE_SIZE_BYTES=4500000
ALLOWED_MIME_TYPES=application/pdf,image/jpeg,image/png,image/webp,text/plain,application/zip,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

Give the Lambda execution role `s3:PutObject` permission for the configured prefix. Configure Function URL CORS for `POST` and `OPTIONS`, with these headers:

```text
content-type, x-file-name, x-file-size, x-upload-id
```

## Docker deployment to EC2

Docker builds the portal and serves it with non-root Nginx on port `3000`.

```bash
docker compose up --build -d
docker compose ps
```

Open `http://<your-ec2-public-dns>:3000/`. Allow inbound TCP port `3000` in the EC2 security group and add that exact origin to Lambda Function URL CORS. The default EC2 hostname supports HTTP only; add HTTPS when you have a custom domain.

## Validate

```bash
python -m py_compile lambda/lambda_function.py
pnpm test
pnpm build
```
