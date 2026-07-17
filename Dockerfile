FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . ./

# Only VITE_* values are used by the browser build. AWS credentials are never
# copied into the image or passed to this build stage.
ARG VITE_LAMBDA_UPLOAD_URL
ARG VITE_LAMBDA_MAX_FILE_SIZE_BYTES=4500000

ENV VITE_LAMBDA_UPLOAD_URL=$VITE_LAMBDA_UPLOAD_URL \
    VITE_LAMBDA_MAX_FILE_SIZE_BYTES=$VITE_LAMBDA_MAX_FILE_SIZE_BYTES

RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.29.4-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
