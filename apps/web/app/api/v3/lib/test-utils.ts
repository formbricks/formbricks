/**
 * Headers a browser sends on a same-origin `fetch`. Session-authenticated and pre-login requests without
 * them are refused by the cross-origin check (`origin-check.ts`), so a route test that drives a write
 * through the real wrapper with a session has to send them, as the dashboard does.
 */
export const SAME_ORIGIN_HEADERS = { "sec-fetch-site": "same-origin" } as const;
