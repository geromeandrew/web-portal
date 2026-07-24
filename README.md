# Web Portal

React 18 portal with an Express API, PostgreSQL workspace state, JWT login, and Lambda-backed uploads. The browser calls only same-origin `/api` routes; Nginx keeps the API and database off the public network.

## Run with Docker

1. Set `LAMBDA_UPLOAD_URL` in `.env` to the existing Lambda Function URL.
2. Run `pnpm env:local -- --force` to generate the local PostgreSQL/JWT/admin settings without retaining legacy AWS access keys.
3. Start the stack:

```bash
docker compose up --build -d
docker compose ps
```

Open `http://<host>:3000/` and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The bootstrap account can create, deactivate, and reset accounts; every account has its own private workspace.

The current portal datasets are seeded per workspace. The API persists upload metadata and workflow state, while the existing Lambda remains responsible for storing the uploaded file. Actual financial/ETL formulas are intentionally not inferred from the existing UI samples.

## Local development

Run PostgreSQL with `docker compose up db -d`, configure `.env`, then start the services in separate terminals:

```bash
pnpm install
pnpm env:local -- --force
pnpm api:build
pnpm db:migrate
pnpm dev:api
pnpm dev
```

Vite proxies `/api` to `http://127.0.0.1:3001` by default. Set `API_PROXY_TARGET` only when using a different local API address.

## Commands

```bash
pnpm test
pnpm build
pnpm api:build
pnpm db:migrate
docker compose config
```

## Security notes

- Do not add AWS access keys to `.env`, Docker files, or browser configuration. Lambda retains responsibility for its own storage credentials.
- JWTs are kept in browser `sessionStorage` to support the requested HTTP deployment. Use HTTPS before exposing the portal outside a trusted environment; browser-stored tokens remain vulnerable to XSS.
- Rotate any cloud credentials that were previously placed in local or tracked environment files.
