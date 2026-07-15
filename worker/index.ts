import type { PresignUploadResponse, UploadCandidate } from "../shared/upload";
import {
  getAllowedOrigins,
  getPresignTtlSeconds,
  type WorkerEnv,
} from "./config";
import { createPresignedPutUrl } from "./s3Presign";
import { sanitizeName, validateCandidate } from "./validation";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function buildCorsHeaders(request: Request, env: WorkerEnv) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins(env);
  const isAllowed = origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin));

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0] ?? "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
}

function assertRequiredEnv(env: WorkerEnv) {
  const requiredKeys: Array<keyof WorkerEnv> = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
    "S3_BUCKET_NAME",
  ];

  const missing = requiredKeys.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required worker configuration: ${missing.join(", ")}`);
  }
}

function createObjectKey(env: WorkerEnv, fileName: string) {
  const now = new Date();
  const prefix = env.S3_KEY_PREFIX?.trim() || "uploads";
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const sessionId = crypto.randomUUID();
  return `${prefix}/${year}/${month}/${day}/${sessionId}/${crypto.randomUUID()}-${sanitizeName(fileName)}`;
}

async function handlePresign(request: Request, env: WorkerEnv) {
  assertRequiredEnv(env);

  const origin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins(env);
  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return json({ error: "Origin is not allowed." }, { status: 403 });
  }

  const payload = (await request.json()) as { files?: UploadCandidate[] };
  const files = payload.files ?? [];

  if (!Array.isArray(files) || files.length === 0) {
    return json({ error: "At least one file is required." }, { status: 400 });
  }

  const uploads: PresignUploadResponse["uploads"] = [];
  const rejected: NonNullable<PresignUploadResponse["rejected"]> = [];

  for (const file of files) {
    const reason = validateCandidate(file, env);
    if (reason) {
      rejected.push({ name: file.name, reason });
      continue;
    }

    const objectKey = createObjectKey(env, file.name);
    const expiresAt = new Date(Date.now() + getPresignTtlSeconds(env) * 1000).toISOString();
    const presigned = await createPresignedPutUrl({
      env,
      objectKey,
      expiresInSeconds: getPresignTtlSeconds(env),
      contentType: file.type,
    });

    uploads.push({
      id: file.id ?? crypto.randomUUID(),
      objectKey,
      uploadUrl: presigned.uploadUrl,
      method: "PUT",
      headers: presigned.headers,
      expiresAt,
    });
  }

  return json({
    uploads,
    rejected: rejected.length > 0 ? rejected : undefined,
  } satisfies PresignUploadResponse);
}

export default {
  async fetch(request: Request, env: WorkerEnv) {
    const corsHeaders = buildCorsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method === "POST" && url.pathname.endsWith("/uploads/presign")) {
      try {
        const response = await handlePresign(request, env);
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      } catch (error) {
        return json(
          {
            error: error instanceof Error ? error.message : "Failed to create upload URLs.",
          },
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }
    }

    return json(
      { error: "Not found." },
      {
        status: 404,
        headers: corsHeaders,
      },
    );
  },
};
