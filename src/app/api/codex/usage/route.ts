import {
  CodexAuthenticationRequiredError,
  fetchCodexUsage,
} from "@/lib/codex/usage-service";

export async function GET() {
  try {
    const snapshot = await fetchCodexUsage();
    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof CodexAuthenticationRequiredError) {
      return Response.json(
        {
          code: "CODEX_AUTH_REQUIRED",
          message: error.message,
        },
        { status: 401 },
      );
    }

    console.error(
      "[AgentMeter] Codex usage refresh failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : "unknown error",
    );
    return Response.json(
      {
        code: "CODEX_UNAVAILABLE",
        message: "暂时无法读取 Codex 用量，请确认本机网络和 Codex 登录状态。",
      },
      { status: 503 },
    );
  }
}
