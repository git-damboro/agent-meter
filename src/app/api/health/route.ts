import { readCodexSnapshot } from "@/lib/codex/snapshot-store";

export const runtime = "nodejs";

export async function GET() {
  let snapshot: "ready" | "pending" | "local" = "local";
  if (process.env.AGENT_METER_USAGE_MODE === "snapshot") {
    try {
      await readCodexSnapshot();
      snapshot = "ready";
    } catch {
      snapshot = "pending";
    }
  }

  return Response.json(
    {
      status: "ok",
      snapshot,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
