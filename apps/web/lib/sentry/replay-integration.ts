// A module of its own so that Session Replay, and the rrweb recorder underneath it, lands in an async
// chunk: `init-client-sentry` imports it dynamically once the page is idle, instead of every page —
// respondent link surveys included — paying for it in first-load JS.
export { replayIntegration } from "@sentry/nextjs";
