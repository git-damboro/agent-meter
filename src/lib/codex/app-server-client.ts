import "server-only";

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import { createInterface } from "node:readline";

interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse {
  id?: number;
  result?: unknown;
  error?: JsonRpcErrorBody;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

const REQUEST_TIMEOUT_MS = 30_000;

export class CodexRpcError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "CodexRpcError";
  }
}

export class CodexAppServerClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, PendingRequest>();
  private nextRequestId = 1;
  private closed = false;

  private constructor(child: ChildProcessWithoutNullStreams) {
    this.child = child;
    const lines = createInterface({ input: child.stdout });

    lines.on("line", (line) => this.handleLine(line));
    child.stderr.on("data", () => {
      // Consume diagnostics so the pipe cannot block. Credentials are never logged.
    });
    child.on("error", (error) => this.rejectAll(error));
    child.on("exit", (code) => {
      if (!this.closed) {
        this.rejectAll(
          new CodexRpcError(`Codex app-server exited unexpectedly (${code}).`),
        );
      }
    });
  }

  static async connect(): Promise<CodexAppServerClient> {
    const child = spawn(process.execPath, [resolveCodexEntry(), "app-server", "--stdio"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LOG_FORMAT: "text",
        RUST_LOG: "error",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const client = new CodexAppServerClient(child);

    await client.request("initialize", {
      clientInfo: {
        name: "agent-meter",
        title: "AgentMeter",
        version: "0.1.0",
      },
      capabilities: null,
    });
    client.notify("initialized");

    return client;
  }

  request<T>(method: string, params?: unknown): Promise<T> {
    if (this.closed) {
      return Promise.reject(new CodexRpcError("Codex app-server is closed."));
    }

    const id = this.nextRequestId++;
    const payload =
      params === undefined ? { method, id } : { method, id, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new CodexRpcError(`Codex request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      this.child.stdin.write(`${JSON.stringify(payload)}\n`, (error) => {
        if (!error) {
          return;
        }
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  notify(method: string, params?: unknown): void {
    const payload = params === undefined ? { method } : { method, params };
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.rejectAll(new CodexRpcError("Codex app-server closed."));
    this.child.kill("SIGTERM");
  }

  private handleLine(line: string): void {
    let message: JsonRpcResponse;
    try {
      message = JSON.parse(line) as JsonRpcResponse;
    } catch {
      return;
    }

    if (typeof message.id !== "number") {
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(
        new CodexRpcError(message.error.message, message.error.code),
      );
      return;
    }
    pending.resolve(message.result);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function resolveCodexEntry(): string {
  return join(
    process.cwd(),
    "node_modules",
    "@openai",
    "codex",
    "bin",
    "codex.js",
  );
}
