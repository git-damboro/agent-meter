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

## Status

Early development. The public repository currently contains the application
scaffold and source integration design.
