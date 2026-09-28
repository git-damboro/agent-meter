# AgentMeter

Local-first usage analytics for Codex subscriptions and imported workspace token reports.

## Scope

- Codex: read quota windows and personal token activity through the official
  `codex app-server` protocol.
- Workspace reports: import exported CSV or XLSX files in the browser.
- Privacy: keep credentials and imported source rows on the local machine.

AgentMeter does not treat ChatGPT Plus usage as OpenAI API billing. Codex
subscription data and imported workspace data retain their own units and source
labels.

## Privacy Model

- Codex authentication is delegated to the official Codex CLI login flow.
- AgentMeter never asks for or stores a ChatGPT OAuth JWT.
- Imported files are parsed in the browser and are not uploaded by the app.
- Real usage exports, credentials, and local snapshots must not be committed.

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

## Status

Early development. The import core is available; the Codex app-server adapter
and dashboard UI are in progress.
