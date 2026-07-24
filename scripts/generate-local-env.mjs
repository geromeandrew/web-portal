import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(".env");
if (existsSync(target) && !process.argv.includes("--force")) {
  console.error("Refusing to overwrite .env. Re-run with --force after backing up anything you need.");
  process.exit(1);
}

const existing = existsSync(target) ? readFileSync(target, "utf8") : "";
const localEnvPath = resolve(".env.local");
const localEnv = existsSync(localEnvPath) ? readFileSync(localEnvPath, "utf8") : "";
const lambdaUrl = `${existing}\n${localEnv}`.match(/^\s*(?:LAMBDA_UPLOAD_URL|VITE_LAMBDA_UPLOAD_URL)\s*=\s*[\"']?([^\s\"']+)/m)?.[1];
if (!lambdaUrl) {
  console.error("LAMBDA_UPLOAD_URL is required. Add it to .env before generating local database credentials.");
  process.exit(1);
}
const secret = (bytes = 24) => randomBytes(bytes).toString("base64url");
const lines = [
  "# Generated local Docker configuration. Keep this file private.",
  "POSTGRES_DB=web_portal",
  "POSTGRES_USER=web_portal",
  `POSTGRES_PASSWORD=${secret()}`,
  `JWT_SECRET=${secret(48)}`,
  "JWT_EXPIRES_IN=8h",
  "ADMIN_EMAIL=admin@portal.local",
  `ADMIN_PASSWORD=${secret()}`,
  `LAMBDA_UPLOAD_URL=${lambdaUrl}`,
  "MAX_UPLOAD_BYTES=4500000",
  "ALLOWED_MIME_TYPES=application/pdf,image/jpeg,image/png,image/webp,text/plain,application/zip,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "",
];
writeFileSync(target, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
console.log("Created .env with generated local credentials. Read ADMIN_PASSWORD from that file to sign in.");
