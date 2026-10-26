# The app uses the public dashboard and chart API

The app's dashboards and charts call the same public `/api/v3` operations that agents and API keys use, not a parallel set of `/api/internal` routes, even though first-party UI otherwise defaults to `/api/internal` (formbricks#9670). Charts and dashboards have external callers by design (P-ENG-85), and the project's promise is one path for the app and agents: when the app goes through the exact contract agents get, every bug the UI hits is one an agent would hit, and the contract tests cover both. Only endpoints with no external caller go internal: AI chart generation (no MCP tool, by decision) and the matrix-question picker.

## Considered Options

- **Two route sets over shared operations** (`/api/v3` for agents, `/api/internal` for the app): rejected because the two would drift in validation, error shapes and limits, and the app would stop proving the public contract.
- **The app stays on server actions and server-rendered data**, with agents alone on v3: rejected for the same reason, and because the dashboard page, the busiest path, would never touch the API.

## Consequences

- What the UI needs has to be expressible in the public contract: the dashboard read embeds each widget's chart, the one-call dashboard save carries an `updatedAt` stale-check, and chart queries get a 600/min bucket sized for dashboards rather than the shared v3 default.
- A change the app wants on these routes is a public API change, held to v3's compatibility rules.
