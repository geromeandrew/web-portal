FROM node:22-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . ./
RUN pnpm build

FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/api ./api
CMD ["sh", "-c", "node build/api/src/migrate.js && node build/api/src/index.js"]

FROM nginxinc/nginx-unprivileged:1.29.4-alpine AS web
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
