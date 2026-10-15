import { test as base } from "@playwright/test";
import { appendFileSync } from "node:fs";
import { createUsersFixture } from "../fixtures/users";

export interface Fixtures {
  users: ReturnType<typeof createUsersFixture>;
  serverActionRecorder: void;
}

/**
 * Opt-in: with `PLAYWRIGHT_SERVER_ACTION_LOG` set to a file path, every server action the browser calls is
 * appended to it as one JSON line (`{ actionId, url, test }`). The ids map back to `file#export` through the
 * build's `.next/server/server-reference-manifest.json`.
 *
 * It is how a migration off server actions proves its coverage (ENG-3984): run a feature's specs against
 * the old build, and every action the feature uses must show up; run them against the new one, and none
 * may. Off by default, so the suite pays nothing for it.
 */
const SERVER_ACTION_LOG = process.env.PLAYWRIGHT_SERVER_ACTION_LOG;

export const test = base.extend<Fixtures>({
  users: async ({ page }, use, workerInfo) => {
    const usersFixture = createUsersFixture(page, workerInfo);
    await use(usersFixture);
  },
  // Auto only when the log is on: an auto fixture that needs a browser context would otherwise create one
  // for every test, API-only ones included. The context, not the page, so popups are recorded too.
  serverActionRecorder: [
    async ({ context }, use, testInfo) => {
      const logFile = SERVER_ACTION_LOG;
      if (logFile) {
        context.on("request", (request) => {
          const actionId = request.headers()["next-action"];
          if (!actionId) return;
          appendFileSync(
            logFile,
            `${JSON.stringify({ actionId, url: request.url(), test: testInfo.titlePath.join(" › ") })}\n`
          );
        });
      }
      await use();
    },
    { auto: Boolean(SERVER_ACTION_LOG) },
  ],
});
