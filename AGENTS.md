# Repository Guidelines

## Project Structure & Module Organization

This repository is a standalone React 18 + Vite + TypeScript upload portal with a Cloudflare Worker signer. Frontend application code lives in `src/`: route components are in `src/routes`, reusable UI components in `src/components`, and upload helpers in `src/lib`. Shared request/response types are in `shared/`. Worker code is in `worker/`, including configuration, validation, and S3 presigning logic. Tests are in `tests/` and currently cover upload state helpers and worker validation. Static assets belong in `public/`; production build output is generated in `dist/` and should not be edited by hand.

## Build, Test, and Development Commands

Use pnpm, matching the configured package manager (`pnpm@10.30.2`).

- `pnpm install`: install dependencies from `pnpm-lock.yaml`.
- `pnpm dev`: run the Vite frontend locally.
- `pnpm worker:dev`: run the Cloudflare Worker locally on port `8787`.
- `pnpm build`: type-check with `tsc -b` and build static assets with Vite.
- `pnpm test`: run Vitest once in non-watch mode.
- `pnpm preview`: preview the built frontend locally.

## Coding Style & Naming Conventions

Write TypeScript modules using ES module imports and two-space indentation. React components should be PascalCase (`UploadDropzone.tsx`), hooks/helpers should use camelCase, and test files should use `*.test.ts`. Keep browser-facing logic in `src/`, Worker-only logic in `worker/`, and cross-boundary types in `shared/`. Styling is Tailwind-based; prefer existing theme tokens from `tailwind.config.ts` such as `ink`, `mist`, `ocean`, and `panel` before adding new colors or shadows.

## Testing Guidelines

Vitest is the test runner. Place tests under `tests/` and name them after the behavior or module under test, for example `workerValidation.test.ts`. Use focused unit tests for pure helpers, validation rules, and state transitions. Run `pnpm test` before submitting changes, and run `pnpm build` when changes touch TypeScript types, Vite configuration, or Worker interfaces.

## Commit & Pull Request Guidelines

Git history is not available in this checkout, so no existing commit convention can be inferred. Use concise, imperative commit subjects such as `Add upload validation test` or `Fix worker MIME parsing`. Pull requests should include a short summary, test results, linked issue or ticket when applicable, and screenshots or screen recordings for UI changes.

## Security & Configuration Tips

Do not commit real secrets. Local frontend settings belong in `.env.local`; Worker secrets should be set with `wrangler secret put`. Keep CORS origins, upload limits, MIME allowlists, and S3 bucket settings aligned between `wrangler.toml`, Cloudflare, and README guidance.
