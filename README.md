# Web Portal

React 18 + Vite frontend for the Web Portal. Its Node.js API lives in the sibling [`../web-portal-api`](../web-portal-api) repository. Browser traffic stays same-origin: Nginx serves this application and proxies `/api/*` privately to the API container.

## Local development

1. Start PostgreSQL and the API from `../web-portal-api`.
2. Copy `.env.example` to `.env.local` if the API is not running at `http://127.0.0.1:3001`.
3. Install and run the frontend:

```bash
pnpm install
pnpm dev
```

## Docker deployment

The API stack must be up and healthy before this frontend stack starts. On the EC2 host, create the shared private network once:

```bash
docker network create web-portal-shared
```

Then deploy the API from `web-portal-api`, followed by this repository:

```bash
docker compose up --build -d
docker compose ps
```

The frontend is published on port `3000`. The API has no host port and is only reachable over the shared Docker network.

## Commands

```bash
pnpm test
pnpm build
pnpm preview
docker compose config
```

## Security notes

- Do not store API, database, JWT, administrator, or Lambda settings in this repository.
- The API owns authentication, workspace state, uploads, and its connection to the existing Lambda upload service.
- Configure HTTPS at the EC2 edge before exposing the portal beyond a trusted network.
