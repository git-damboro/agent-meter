import {
  CodexAuthenticationRequiredError,
  fetchCodexUsage,
} from "@/lib/codex/usage-service";
import {
  readCodexSnapshot,
  sanitizeCodexUsageSnapshot,
} from "@/lib/codex/snapshot-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const snapshot =
      process.env.AGENT_METER_USAGE_MODE === "snapshot"
        ? await readCodexSnapshot()
        : await fetchCodexUsage();
    return Response.json(sanitizeCodexUsageSnapshot(snapshot), {
      headers: responseHeaders(request),
    });
  } catch (error) {
    if (error instanceof CodexAuthenticationRequiredError) {
      return Response.json(
        {
          code: "CODEX_AUTH_REQUIRED",
          message: error.message,
        },
        { status: 401, headers: responseHeaders(request) },
      );
    }

    console.error(
      "[AgentMeter] Codex usage refresh failed:",
      safeErrorName(error),
    );
    return Response.json(
      {
        code:
          process.env.AGENT_METER_USAGE_MODE === "snapshot"
            ? "CODEX_SNAPSHOT_UNAVAILABLE"
            : "CODEX_UNAVAILABLE",
        message:
          process.env.AGENT_METER_USAGE_MODE === "snapshot"
            ? "Codex 用量快照尚未生成，请稍后重试。"
            : "暂时无法读取 Codex 用量，请确认本机网络和 Codex 登录状态。",
      },
      { status: 503, headers: responseHeaders(request) },
    );
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: responseHeaders(request),
  });
}

function responseHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigins = (process.env.AGENT_METER_PUBLIC_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (allowedOrigins.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
  }
  if (headers["Access-Control-Allow-Origin"]) {
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return headers;
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
