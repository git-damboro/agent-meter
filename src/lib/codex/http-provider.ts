import { z } from "zod";

import {
  codexHttpProfileResponseSchema,
  codexHttpUsageResponseSchema,
  codexPersonalAccessTokenMetadataSchema,
  type CodexHttpUsageResponse,
  type CodexQuotaWindow,
  type CodexUsageSnapshot,
} from "@/lib/codex/types";

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const ACCESS_TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const SESSION_WINDOW_SECONDS = 5 * 60 * 60;
const WEEKLY_WINDOW_SECONDS = 7 * 24 * 60 * 60;

export interface CodexHttpEndpoints {
  profile: string;
  usage: string;
  refresh: string;
  personalAccessTokenMetadata: string;
}

export const CODEX_HTTP_ENDPOINTS: CodexHttpEndpoints = {
  profile: "https://chatgpt.com/backend-api/wham/profiles/me",
  usage: "https://chatgpt.com/backend-api/wham/usage",
  refresh: "https://auth.openai.com/oauth/token",
  personalAccessTokenMetadata:
    "https://auth.openai.com/api/accounts/v1/user-auth-credential/whoami",
} as const;

export const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

export interface CodexPersonalAccessTokenCredential {
  type: "personal-access-token";
  token: string;
}

export interface CodexOAuthCredential {
  type: "oauth";
  accessToken?: string;
  refreshToken?: string;
  accountId: string;
  email?: string;
  planType?: string;
  refreshedAt?: string;
}

export type CodexServerCredential =
  | CodexPersonalAccessTokenCredential
  | CodexOAuthCredential;

export interface CodexHttpProviderResult {
  snapshot: CodexUsageSnapshot;
  credential: CodexServerCredential;
}

export type CodexProviderErrorCode =
  | "CODEX_AUTH_REQUIRED"
  | "CODEX_CONFIGURATION_ERROR"
  | "CODEX_INVALID_RESPONSE"
  | "CODEX_UPSTREAM_ERROR";

export class CodexProviderError extends Error {
  constructor(
    readonly code: CodexProviderErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CodexProviderError";
  }
}

interface CodexHttpProviderOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  requestTimeoutMs?: number;
  endpoints?: Partial<CodexHttpEndpoints>;
}

interface ResolvedCredential {
  accessToken: string;
  accountId: string;
  email?: string;
  planType?: string;
}

const oauthRefreshResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
});

export async function fetchCodexUsageWithCredential(
  credential: CodexServerCredential,
  options: CodexHttpProviderOptions = {},
): Promise<CodexHttpProviderResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const requestTimeoutMs =
    options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const endpoints = { ...CODEX_HTTP_ENDPOINTS, ...options.endpoints };

  let activeCredential = credential;
  let wasRefreshed = false;

  if (
    activeCredential.type === "oauth" &&
    shouldRefreshAccessToken(activeCredential, now())
  ) {
    activeCredential = await refreshOAuthCredential(
      activeCredential,
      fetchImpl,
      endpoints.refresh,
      requestTimeoutMs,
      now,
    );
    wasRefreshed = true;
  }

  let resolved = await resolveCredential(
    activeCredential,
    fetchImpl,
    endpoints.personalAccessTokenMetadata,
    requestTimeoutMs,
  );

  try {
    const snapshot = await fetchSnapshot(
      resolved,
      fetchImpl,
      endpoints,
      requestTimeoutMs,
      now,
    );
    return { snapshot, credential: activeCredential };
  } catch (error) {
    if (
      !(error instanceof CodexProviderError) ||
      error.code !== "CODEX_AUTH_REQUIRED" ||
      activeCredential.type !== "oauth" ||
      !activeCredential.refreshToken ||
      wasRefreshed
    ) {
      throw error;
    }

    activeCredential = await refreshOAuthCredential(
      activeCredential,
      fetchImpl,
      endpoints.refresh,
      requestTimeoutMs,
      now,
    );
    resolved = await resolveCredential(
      activeCredential,
      fetchImpl,
      endpoints.personalAccessTokenMetadata,
      requestTimeoutMs,
    );
    const snapshot = await fetchSnapshot(
      resolved,
      fetchImpl,
      endpoints,
      requestTimeoutMs,
      now,
    );
    return { snapshot, credential: activeCredential };
  }
}

async function resolveCredential(
  credential: CodexServerCredential,
  fetchImpl: typeof fetch,
  metadataEndpoint: string,
  requestTimeoutMs: number,
): Promise<ResolvedCredential> {
  if (credential.type === "oauth") {
    if (!credential.accessToken) {
      throw new CodexProviderError(
        "CODEX_CONFIGURATION_ERROR",
        "Codex OAuth access token is unavailable.",
      );
    }
    return {
      accessToken: credential.accessToken,
      accountId: credential.accountId,
      email: credential.email,
      planType: credential.planType,
    };
  }

  if (!credential.token.startsWith("at-")) {
    throw new CodexProviderError(
      "CODEX_CONFIGURATION_ERROR",
      "Codex personal access token must use the at- prefix.",
    );
  }

  const metadata = parsePayload(
    codexPersonalAccessTokenMetadataSchema,
    await requestJson(
      metadataEndpoint,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credential.token}`,
        },
      },
      fetchImpl,
      requestTimeoutMs,
    ),
  );

  return {
    accessToken: credential.token,
    accountId: metadata.chatgpt_account_id,
    email: metadata.email ?? undefined,
    planType: metadata.chatgpt_plan_type,
  };
}

async function fetchSnapshot(
  credential: ResolvedCredential,
  fetchImpl: typeof fetch,
  endpoints: typeof CODEX_HTTP_ENDPOINTS,
  requestTimeoutMs: number,
  now: () => Date,
): Promise<CodexUsageSnapshot> {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${credential.accessToken}`,
    "ChatGPT-Account-Id": credential.accountId,
  };
  const [profileBody, usageBody] = await Promise.all([
    requestJson(
      endpoints.profile,
      { headers },
      fetchImpl,
      requestTimeoutMs,
    ),
    requestJson(endpoints.usage, { headers }, fetchImpl, requestTimeoutMs),
  ]);
  const profile = parsePayload(codexHttpProfileResponseSchema, profileBody);
  const usage = parsePayload(codexHttpUsageResponseSchema, usageBody);
  const windows = mapRateLimitWindows(usage);

  return {
    source: "codex",
    fetchedAt: now().toISOString(),
    account: {
      email: credential.email,
      planType: usage.plan_type ?? credential.planType,
    },
    summary: {
      lifetimeTokens: profile.stats.lifetime_tokens ?? undefined,
      peakDailyTokens: profile.stats.peak_daily_tokens ?? undefined,
      longestRunningTurnSec:
        profile.stats.longest_running_turn_sec ?? undefined,
      currentStreakDays: profile.stats.current_streak_days ?? undefined,
      longestStreakDays: profile.stats.longest_streak_days ?? undefined,
    },
    daily:
      profile.stats.daily_usage_buckets?.map((point) => ({
        date: point.start_date,
        tokens: point.tokens,
      })) ?? [],
    quota: {
      ordinaryUsageAllowed: usage.rate_limit?.allowed ?? undefined,
      primary: windows.primary,
      secondary: windows.secondary,
      availableResetCredits:
        usage.rate_limit_reset_credits?.available_count ?? undefined,
    },
  };
}

async function refreshOAuthCredential(
  credential: CodexOAuthCredential,
  fetchImpl: typeof fetch,
  endpoint: string,
  requestTimeoutMs: number,
  now: () => Date,
): Promise<CodexOAuthCredential> {
  if (!credential.refreshToken) {
    throw new CodexProviderError(
      "CODEX_AUTH_REQUIRED",
      "Codex OAuth credential has expired and cannot be refreshed.",
    );
  }

  const refreshed = parsePayload(
    oauthRefreshResponseSchema,
    await requestJson(
      endpoint,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: CODEX_OAUTH_CLIENT_ID,
          grant_type: "refresh_token",
          refresh_token: credential.refreshToken,
        }),
      },
      fetchImpl,
      requestTimeoutMs,
    ),
  );

  return {
    ...credential,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? credential.refreshToken,
    refreshedAt: now().toISOString(),
  };
}

function shouldRefreshAccessToken(
  credential: CodexOAuthCredential,
  now: Date,
): boolean {
  if (!credential.accessToken) {
    return true;
  }
  const expiresAt = readJwtExpiration(credential.accessToken);
  return (
    expiresAt !== undefined &&
    expiresAt <= now.getTime() + ACCESS_TOKEN_REFRESH_WINDOW_MS
  );
}

function readJwtExpiration(token: string): number | undefined {
  const payload = token.split(".")[1];
  if (!payload) {
    return undefined;
  }
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

function mapRateLimitWindows(usage: CodexHttpUsageResponse): {
  primary?: CodexQuotaWindow;
  secondary?: CodexQuotaWindow;
} {
  const first = mapRateLimitWindow(usage.rate_limit?.primary_window);
  const second = mapRateLimitWindow(usage.rate_limit?.secondary_window);
  const windows = [first, second].filter(
    (window): window is CodexQuotaWindow => window !== undefined,
  );
  const primary = windows.find(
    (window) => window.windowDurationMins === SESSION_WINDOW_SECONDS / 60,
  );
  const secondary = windows.find(
    (window) => window.windowDurationMins === WEEKLY_WINDOW_SECONDS / 60,
  );

  if (!primary && !secondary) {
    return { primary: first, secondary: second };
  }
  return { primary, secondary };
}

function mapRateLimitWindow(
  window:
    | {
        used_percent: number;
        limit_window_seconds?: number | null;
        reset_at?: number | null;
      }
    | null
    | undefined,
): CodexQuotaWindow | undefined {
  if (!window) {
    return undefined;
  }
  return {
    usedPercent: Math.min(100, Math.max(0, window.used_percent)),
    windowDurationMins:
      window.limit_window_seconds == null
        ? undefined
        : window.limit_window_seconds / 60,
    resetsAt: window.reset_at ?? undefined,
  };
}

async function requestJson(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  requestTimeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      throw new CodexProviderError(
        "CODEX_AUTH_REQUIRED",
        "Codex credential was rejected.",
        response.status,
      );
    }
    if (!response.ok) {
      throw new CodexProviderError(
        "CODEX_UPSTREAM_ERROR",
        `Codex upstream request failed with status ${response.status}.`,
        response.status,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new CodexProviderError(
        "CODEX_INVALID_RESPONSE",
        "Codex upstream returned invalid JSON.",
        response.status,
      );
    }
  } catch (error) {
    if (error instanceof CodexProviderError) {
      throw error;
    }
    throw new CodexProviderError(
      "CODEX_UPSTREAM_ERROR",
      error instanceof Error && error.name === "AbortError"
        ? "Codex upstream request timed out."
        : "Codex upstream request failed.",
    );
  } finally {
    clearTimeout(timer);
  }
}

function parsePayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new CodexProviderError(
      "CODEX_INVALID_RESPONSE",
      "Codex upstream response did not match the expected schema.",
    );
  }
  return result.data;
}
