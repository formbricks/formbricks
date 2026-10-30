/**
 * The header a browser's own `fetch` carries. The dashboard's API routes refuse session-authenticated
 * writes without it (`app/api/v3/lib/origin-check.ts`), and Playwright's `page.request` sends none, so a
 * spec that writes through the dashboard's API with the page's session has to add it, as the app does.
 */
export const SAME_ORIGIN_HEADERS = { "sec-fetch-site": "same-origin" } as const;
