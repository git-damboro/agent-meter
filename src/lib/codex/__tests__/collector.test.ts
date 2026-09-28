import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { collectCodexUsageOnce } from "@/lib/codex/collector";
import { CODEX_HTTP_ENDPOINTS } from "@/lib/codex/http-provider";

const now = new Date("2026-09-28T08:00:00.000Z");

describe("collectCodexUsageOnce", () => {
  it("persists rotated credentials privately before publishing a redacted snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-meter-collector-"));
    const dataDir = join(root, "public");
    const credentialPath = join(root, "private", "codex-credentials.json");
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = input.toString();
      if (url === CODEX_HTTP_ENDPOINTS.refresh) {
        return jsonResponse({
          access_token: "access-new",
          refresh_token: "refresh-new",
        });
      }
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer access-new",
      );
      if (url === CODEX_HTTP_ENDPOINTS.profile) {
        return jsonResponse({
          stats: {
            lifetime_tokens: 42,
            daily_usage_buckets: [
              { start_date: "2026-09-28", tokens: 42 },
            ],
          },
        });
      }
      if (url === CODEX_HTTP_ENDPOINTS.usage) {
        return jsonResponse({
          plan_type: "plus",
          rate_limit: {
            allowed: true,
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const snapshot = await collectCodexUsageOnce({
      env: {
        NODE_ENV: "test",
        AGENT_METER_DATA_DIR: dataDir,
        AGENT_METER_CREDENTIALS_PATH: credentialPath,
        CODEX_ACCOUNT_ID: "account-1",
        CODEX_ACCOUNT_EMAIL: "private@example.com",
        CODEX_ACCESS_TOKEN: makeJwt(
          Math.floor(now.getTime() / 1000) + 30,
        ),
        CODEX_REFRESH_TOKEN: "refresh-old",
      },
      fetchImpl,
      now: () => now,
    });
    const publicText = await readFile(
      join(dataDir, "codex-usage.json"),
      "utf8",
    );
    const privateText = await readFile(credentialPath, "utf8");

    expect(snapshot.account).toEqual({ planType: "plus" });
    expect(publicText).not.toContain("private@example.com");
    expect(publicText).not.toContain("access-new");
    expect(publicText).not.toContain("refresh-new");
    expect(privateText).toContain("access-new");
    expect(privateText).toContain("refresh-new");
    expect(privateText).not.toContain("private@example.com");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function makeJwt(expiresAt: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString(
    "base64url",
  );
  return `${header}.${payload}.signature`;
}
