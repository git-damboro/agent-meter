import "server-only";

import {
  CodexAppServerClient,
  CodexRpcError,
} from "@/lib/codex/app-server-client";
import { mapCodexUsageSnapshot } from "@/lib/codex/mapper";
import {
  codexAccountResponseSchema,
  codexRateLimitsResponseSchema,
  codexTokenUsageResponseSchema,
  type CodexUsageSnapshot,
} from "@/lib/codex/types";

export class CodexAuthenticationRequiredError extends Error {
  constructor() {
    super("需要先使用 ChatGPT 账号登录 Codex。");
    this.name = "CodexAuthenticationRequiredError";
  }
}

export async function fetchCodexUsage(): Promise<CodexUsageSnapshot> {
  const client = await CodexAppServerClient.connect();

  try {
    const account = codexAccountResponseSchema.parse(
      await client.request("account/read", { refreshToken: false }),
    );
    if (!account.account || account.account.type !== "chatgpt") {
      throw new CodexAuthenticationRequiredError();
    }

    const [usage, rateLimits] = await Promise.all([
      client
        .request("account/usage/read")
        .then((response) => codexTokenUsageResponseSchema.parse(response)),
      client
        .request("account/rateLimits/read", {
          excludeResetCreditDetails: true,
        })
        .then((response) => codexRateLimitsResponseSchema.parse(response)),
    ]);

    return mapCodexUsageSnapshot(account, usage, rateLimits);
  } catch (error) {
    if (
      error instanceof CodexRpcError &&
      /authentication required|chatgpt authentication/i.test(error.message)
    ) {
      throw new CodexAuthenticationRequiredError();
    }
    throw error;
  } finally {
    client.close();
  }
}
