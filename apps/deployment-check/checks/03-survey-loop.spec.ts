import { CheckFailure } from "../src/diagnostics.ts";
import { expect, tierTest } from "../src/fixtures.ts";
import { readState } from "../src/run-state.ts";
import { buildLoopSurvey } from "../src/survey.ts";
import { createSurvey } from "../src/surveys-api.ts";

const test = tierTest("survey-loop");

test.describe.configure({ mode: "serial" });

const PHRASE = `deployment-check-${Date.now()}`;
const POLL_FOR_MS = 15_000;

let surveyId = "";

test("creates a link survey through the API", async ({ api }) => {
  const { workspaceId } = readState();
  expect(workspaceId, "a workspace id from the auth tier").toBeTruthy();

  surveyId = await createSurvey(api, buildLoopSurvey(workspaceId as string, new Date()));
});

test("answers it in a browser", async ({ page, config }) => {
  await page.goto(`${config.publicUrl}/s/${surveyId}`);

  await page.getByRole("textbox").first().fill(PHRASE);
  // The radio input is visually hidden behind its numbered label, so click the label.
  await page.getByText("3", { exact: true }).click();
  // The submit label is the block's own `buttonLabel` or falls back to Next/Finish.
  await page.getByRole("button", { name: /^(Next|Finish)$/ }).click();

  await expect(
    page.getByText("Deployment check complete"),
    "the survey page should reach its ending card; the survey bundle, client API or database write failed"
  ).toBeVisible({ timeout: 30_000 });
});

test("the response is readable through the API", async ({ api }) => {
  const { workspaceId } = readState();
  const deadline = Date.now() + POLL_FOR_MS;
  let lastStatus = 0;

  while (Date.now() < deadline) {
    const response = await api.get(
      `/api/v3/responses?workspaceId=${workspaceId as string}&surveyId=${surveyId}`
    );
    lastStatus = response.status;
    const rows = (response.json as { data?: unknown[] } | undefined)?.data ?? [];

    if (rows.some((row) => JSON.stringify(row).includes(PHRASE))) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new CheckFailure(
    "Response pipeline",
    `the submitted answer did not appear in GET /api/v3/responses within ${POLL_FOR_MS / 1000}s (last HTTP ${lastStatus})`,
    "check the app logs for the POST to /api/v1/client/<workspaceId>/responses and that the database accepts writes"
  );
});
