import { describe, expect, it, vi } from "vitest";

import {
  CODEX_OAUTH_CLIENT_ID,
  CodexProviderError,
  fetchCodexUsageWithCredential,
  type CodexHttpEndpoints,
} from "@/lib/codex/http-provider";

const endpoints: CodexHttpEndpoints = {
  profile: "https://provider.test/profile",
  usage: "https://provider.test/usage",
  refresh: "https://provider.test/refresh",
  personalAccessTokenMetadata: "https://provider.test/whoami",
};

const now = new Date("2026-09-28T08:00:00.000Z");

describe("fetchCodexUsageWithCredential", () => {
  it("hydrates a PAT and maps profile plus quota without trusting slot order", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = input.toString();
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer at-secret",
      );

      if (url === endpoints.personalAccessTokenMetadata) {
        return jsonResponse({
          email: "owner@example.com",
          chatgpt_account_id: "account-1",
          chatgpt_user_id: "user-1",
          chatgpt_plan_type: "plus",
        });
      }
      expect(new Headers(init?.headers).get("chatgpt-account-id")).toBe(
        "account-1",
      );
      if (url === endpoints.profile) {
        return jsonResponse({
          stats: {
            lifetime_tokens: 1_250_000,
            peak_daily_tokens: 120_000,
            current_streak_days: 4,
            longest_streak_days: 11,
            longest_running_turn_sec: 840,
            daily_usage_buckets: [
              { start_date: "2026-09-27", tokens: 75_000 },
            ],
          },
        });
      }
      if (url === endpoints.usage) {
        return jsonResponse({
          plan_type: "plus",
          rate_limit: {
            allowed: true,
            primary_window: {
              used_percent: 4,
              limit_window_seconds: 604_800,
              reset_at: 1_790_500_000,
            },
            secondary_window: {
              used_percent: 27,
              limit_window_seconds: 18_000,
              reset_at: 1_790_000_000,
            },
          },
          rate_limit_reset_credits: {
            available_count: 2,
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchCodexUsageWithCredential(
      {
        type: "personal-access-token",
        token: "at-secret",
      },
      { endpoints, fetchImpl, now: () => now },
    );

    expect(result.snapshot.account).toEqual({
      email: "owner@example.com",
      planType: "plus",
    });
    expect(result.snapshot.summary.lifetimeTokens).toBe(1_250_000);
    expect(result.snapshot.daily).toEqual([
      { date: "2026-09-27", tokens: 75_000 },
    ]);
    expect(result.snapshot.quota.primary?.windowDurationMins).toBe(300);
    expect(result.snapshot.quota.secondary?.windowDurationMins).toBe(10_080);
    expect(result.snapshot.quota.availableResetCredits).toBe(2);
  });

  it("refreshes an expiring OAuth token and returns the rotated credential", async () => {
    const expiredAccessToken = makeJwt(
      Math.floor(now.getTime() / 1000) + 30,
    );
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = input.toString();
      calls.push({ url, init });
      if (url === endpoints.refresh) {
        expect(JSON.parse(String(init?.body))).toEqual({
          client_id: CODEX_OAUTH_CLIENT_ID,
          grant_type: "refresh_token",
          refresh_token: "refresh-old",
        });
        return jsonResponse({
          access_token: "access-new",
          refresh_token: "refresh-new",
        });
      }
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer access-new",
      );
      if (url === endpoints.profile) {
        return jsonResponse({
          stats: {
            lifetime_tokens: 99,
            daily_usage_buckets: [],
          },
        });
      }
      if (url === endpoints.usage) {
        return jsonResponse({
          plan_type: "plus",
          rate_limit: {},
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchCodexUsageWithCredential(
      {
        type: "oauth",
        accessToken: expiredAccessToken,
        refreshToken: "refresh-old",
        accountId: "account-2",
      },
      { endpoints, fetchImpl, now: () => now },
    );

    expect(calls[0].url).toBe(endpoints.refresh);
    expect(result.credential).toEqual({
      type: "oauth",
      accessToken: "access-new",
      refreshToken: "refresh-new",
      accountId: "account-2",
      refreshedAt: now.toISOString(),
    });
  });

  it("never includes an upstream response body in provider errors", async () => {
    const leakedValue = "at-never-log-this";
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ error: leakedValue }, 500),
    );

    let thrown: unknown;
    try {
      await fetchCodexUsageWithCredential(
        {
          type: "personal-access-token",
          token: "at-secret",
        },
        { endpoints, fetchImpl, now: () => now },
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CodexProviderError);
    expect(String(thrown)).not.toContain(leakedValue);
    expect(thrown).toMatchObject({
      code: "CODEX_UPSTREAM_ERROR",
      status: 500,
    });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
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
