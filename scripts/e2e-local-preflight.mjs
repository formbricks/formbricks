#!/usr/bin/env node
/* Stops `pnpm test:e2e:local` before Playwright starts when the dev server can't serve the sign-in
 * page: every spec signs in first, so a broken server otherwise costs a full timeout per spec. After a
 * merge of main, see docs/agents/monorepo-builds.md ("A dev server after pulling or merging main"). */
const URL_TO_CHECK = new URL("/auth/login", process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").href;

try {
  const response = await fetch(URL_TO_CHECK, { signal: AbortSignal.timeout(30_000) });
  if (response.status !== 200) {
    console.error(`${URL_TO_CHECK} answered ${response.status}, not 200: fix the dev server first.`);
    process.exit(1);
  }
} catch (error) {
  console.error(`${URL_TO_CHECK} is not reachable (${error.message}): start the dev server first.`);
  process.exit(1);
}
