# Repository Guidelines

## Project Structure & Module Organization

This repository is the standalone React 18 + Vite + TypeScript frontend for the Web Portal. Application code lives in `src/`: route components are in `src/routes`, reusable UI components in `src/components`, authentication state in `src/auth`, and browser API helpers in `src/lib`. Tests are in `tests/`. Static assets belong in `public/`; production build output is generated in `dist/` and should not be edited by hand.

The Node.js API, PostgreSQL migrations, API environment configuration, and Lambda upload integration live in the sibling `../web-portal-api` repository. Keep browser requests relative to `/api` so the production Nginx proxy and local Vite proxy behave identically.

## Build, Test, and Development Commands

Use pnpm, matching the configured package manager (`pnpm@10.30.2`).

- `pnpm install`: install dependencies from `pnpm-lock.yaml`.
- `pnpm dev`: run the Vite frontend locally.
- `pnpm build`: type-check and build static assets.
- `pnpm test`: run Vitest once in non-watch mode.
- `pnpm preview`: preview the built frontend locally.

## Coding Style & Naming Conventions

Write TypeScript modules using ES module imports and two-space indentation. React components should be PascalCase (`UploadDropzone.tsx`), hooks/helpers should use camelCase, and test files should use `*.test.ts`. Styling is Tailwind-based; prefer existing theme tokens from `tailwind.config.ts` such as `ink`, `mist`, `ocean`, and `panel` before adding new colors or shadows.

## Testing Guidelines

Vitest is the test runner. Place tests under `tests/` and name them after the behavior or module under test. Use focused unit tests for browser helpers and state transitions. Run `pnpm test` before submitting changes, and run `pnpm build` when changes touch TypeScript types, Vite configuration, or Nginx-facing behavior.

## Security & Configuration Tips

Do not commit secrets. Frontend local settings belong in `.env.local`; only `API_PROXY_TARGET` is supported. Production API, database, JWT, administrator, and Lambda configuration belong in `../web-portal-api/.env`. The Docker deployment requires the external `web-portal-shared` network to connect the frontend proxy to the private API service.
