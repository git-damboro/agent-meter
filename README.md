# AgentMeter

Local-first usage analytics for Codex subscriptions and imported workspace
token reports, with a Docker collector for publishing a sanitized personal
snapshot.

## Scope

- Codex local mode: read quota windows and personal token activity through the
  official `codex app-server` protocol.
- Codex server mode: refresh one owner's server credential, read the same
  backend data used by Codex, and publish a sanitized snapshot.
- Workspace reports: import exported CSV or XLSX files in the browser.
- Privacy: keep provider credentials out of the Web process and imported source
  rows inside the browser.

AgentMeter does not treat ChatGPT Plus usage as OpenAI API billing. Codex
subscription data and imported workspace data retain their own units and source
labels.

## Runtime Modes

- `local` is the default development mode. The API starts `codex app-server`
  for each refresh and reuses the local Codex CLI login.
- `snapshot` is the Docker mode. A dedicated collector owns the provider
  credential and atomically writes `codex-usage.json`; the Web service mounts
  that volume read-only.

The direct Codex HTTP adapter is intentionally isolated because the WHAM
endpoints are used by the open-source Codex client but are not documented as a
stable public REST API.

## Development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Workspace Import

Export the source sheet as CSV or XLSX. AgentMeter detects the header row and
uses these columns:

- Required: `日期`, `Token消耗`
- Optional: `成本(RMB)`, `曲线`, `部门`, `模型大类`, `模型`, `数据状态`

Rows are normalized and aggregated by date in the browser. A synthetic example
is available at `public/examples/bytedance-token-sample.csv`.

## Codex Connection

AgentMeter uses the official `@openai/codex` app-server methods:

- `account/usage/read` for lifetime totals, daily buckets, streaks, and peaks.
- `account/rateLimits/read` for current quota windows and reset times.

A normal OpenAI API key cannot read ChatGPT Plus quota. Sign in through the
official Codex CLI instead:

```bash
npx codex login --device-auth
```

AgentMeter then reuses that local login for each refresh and closes the
app-server child process after the request.

## Docker Deployment

Create an ignored `.env` from the committed template, then configure one
credential mode:

```bash
cp docker.env.example .env
chmod 600 .env
```

- Preferred: set `CODEX_PERSONAL_ACCESS_TOKEN` to an `at-` token.
- OAuth fallback: set `CODEX_ACCOUNT_ID`, `CODEX_ACCESS_TOKEN`, and
  `CODEX_REFRESH_TOKEN`.
- Increment `CODEX_CREDENTIAL_VERSION` when intentionally replacing the OAuth
  bundle, so the collector stops using its previously rotated state.
- Set `AGENT_METER_PUBLIC_ORIGIN` to the personal website origin when browser
  access is cross-origin. Multiple origins can be comma-separated.

Start both processes:

```bash
docker compose up --build -d
docker compose ps
curl http://localhost:3000/api/health
curl http://localhost:3000/api/codex/usage
```

The collector runs immediately and then every
`AGENT_METER_COLLECT_INTERVAL_SECONDS` seconds, with a minimum interval of 60
seconds. Run one collection manually with:

```bash
docker compose run --rm collector node collector.mjs --once
```

Compose creates two named volumes:

- `agent-meter-public`: sanitized snapshot, writable by the collector and
  mounted read-only by Web.
- `agent-meter-private`: rotated OAuth state, mounted only by the collector.

The Web container receives no Codex credential environment variables. The
public API never returns account email, access tokens, refresh tokens, or
unknown upstream fields. Protect the Docker host and private volume because
OAuth state is file-permission protected, not encrypted at rest.

## Public API

`GET /api/codex/usage` returns the latest sanitized `CodexUsageSnapshot`.
`GET /api/health` reports Web liveness and whether a snapshot is ready. Both
responses disable HTTP caching; the usage endpoint only emits CORS headers for
origins listed in `AGENT_METER_PUBLIC_ORIGIN`.

## Privacy Model

- A normal `sk-` OpenAI API key cannot read ChatGPT subscription usage.
- PAT and OAuth credentials belong only in deployment secrets or ignored local
  environment files.
- OAuth refresh token rotation is persisted with atomic `0600` writes.
- Imported CSV/XLSX files are parsed in the browser and never uploaded.
- Real usage exports, credentials, and local snapshots must not be committed.

## Status

The current dashboard and Docker collector provide:

- Codex lifetime, peak, streak, daily activity, and quota windows.
- Workspace CSV/XLSX totals, cost, date range, trend, and activity intensity.
- Daily, weekly, and cumulative chart modes.
- Local browser persistence for imported workspace aggregates.
- Scheduled server collection and a read-only public snapshot API.
