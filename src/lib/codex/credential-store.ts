import { join } from "node:path";
import { z } from "zod";

import {
  CodexProviderError,
  type CodexOAuthCredential,
  type CodexServerCredential,
} from "@/lib/codex/http-provider";
import { getAgentMeterDataDir } from "@/lib/codex/snapshot-store";
import {
  readJsonFile,
  writeJsonAtomic,
} from "@/lib/storage/atomic-json";

const credentialStateSchema = z.object({
  version: z.literal(1),
  credentialVersion: z.string().optional(),
  credential: z.object({
    type: z.literal("oauth"),
    accessToken: z.string().min(1).optional(),
    refreshToken: z.string().min(1).optional(),
    accountId: z.string().min(1),
    refreshedAt: z.string().optional(),
  }),
});

interface LoadedCredential {
  credential: CodexServerCredential;
  credentialVersion?: string;
  credentialPath: string;
}

export function getCodexCredentialPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.AGENT_METER_CREDENTIALS_PATH?.trim() ||
    join(getAgentMeterDataDir(env), "private", "codex-credentials.json")
  );
}

export async function loadCodexServerCredential(
  env: NodeJS.ProcessEnv = process.env,
): Promise<LoadedCredential> {
  const personalAccessToken = readNonEmpty(
    env.CODEX_PERSONAL_ACCESS_TOKEN,
  );
  const credentialPath = getCodexCredentialPath(env);
  const credentialVersion = readNonEmpty(env.CODEX_CREDENTIAL_VERSION);

  if (personalAccessToken) {
    return {
      credential: {
        type: "personal-access-token",
        token: personalAccessToken,
      },
      credentialPath,
      credentialVersion,
    };
  }

  const accountId = readNonEmpty(env.CODEX_ACCOUNT_ID);
  const accessToken = readNonEmpty(env.CODEX_ACCESS_TOKEN);
  const refreshToken = readNonEmpty(env.CODEX_REFRESH_TOKEN);
  if (!accountId || (!accessToken && !refreshToken)) {
    throw new CodexProviderError(
      "CODEX_CONFIGURATION_ERROR",
      "Configure CODEX_PERSONAL_ACCESS_TOKEN or CODEX_ACCOUNT_ID with an OAuth access or refresh token.",
    );
  }

  const persisted = await readPersistedOAuthCredential(credentialPath);
  const canReusePersisted =
    persisted?.credential.accountId === accountId &&
    persisted.credentialVersion === credentialVersion;
  const credential = canReusePersisted
    ? persisted.credential
    : {
        type: "oauth" as const,
        accessToken,
        refreshToken,
        accountId,
      };

  return {
    credential: {
      ...credential,
      email: readNonEmpty(env.CODEX_ACCOUNT_EMAIL),
      planType: readNonEmpty(env.CODEX_PLAN_TYPE),
    },
    credentialPath,
    credentialVersion,
  };
}

export async function persistCodexOAuthCredential(
  path: string,
  credential: CodexOAuthCredential,
  credentialVersion?: string,
): Promise<void> {
  await writeJsonAtomic(path, {
    version: 1,
    credentialVersion,
    credential: {
      type: "oauth",
      accessToken: credential.accessToken,
      refreshToken: credential.refreshToken,
      accountId: credential.accountId,
      refreshedAt: credential.refreshedAt,
    },
  });
}

async function readPersistedOAuthCredential(
  path: string,
): Promise<z.infer<typeof credentialStateSchema> | undefined> {
  try {
    const result = credentialStateSchema.safeParse(await readJsonFile(path));
    if (!result.success) {
      throw new CodexProviderError(
        "CODEX_CONFIGURATION_ERROR",
        "Persisted Codex credential state is invalid.",
      );
    }
    return result.data;
  } catch (error) {
    if (isMissingFile(error)) {
      return undefined;
    }
    throw error;
  }
}

function readNonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
