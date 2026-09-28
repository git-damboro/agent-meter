import { cp, mkdir } from "node:fs/promises";

await mkdir(".next/standalone/.next", { recursive: true });
await Promise.all([
  cp("public", ".next/standalone/public", { recursive: true }),
  cp(".next/static", ".next/standalone/.next/static", { recursive: true }),
]);
