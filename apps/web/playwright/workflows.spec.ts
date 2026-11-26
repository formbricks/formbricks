import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { hasWorkflowsLicense } from "./utils/license";
import { SAME_ORIGIN_HEADERS } from "./utils/same-origin";

/**
 * The Workflows journey (ENG-7183): the one place the editor, a Test run's fake effects, the Webhook
 * Secret URL, the run queue and the runs list meet. A Webhook workflow with an If/else is seeded
 * through API v3; in the editor a test payload takes the Then branch and the email "would send"; once
 * enabled, a real call to the Secret URL starts a run that takes the Else branch and shows in the Runs
 * view beside the Test run, where the Live filter keeps it alone.
 *
 * The real call takes the Else branch, which is empty, so the run sends no email: the journey needs no
 * mail server, and the Then branch's email is proven by the Test run.
 *
 * The instance's Enterprise license must include Workflows; the journey checks that first and skips
 * without it.
 */

const WORKFLOW_NAME = "Enterprise sign-ups";
const IF_ELSE_LABEL = "Enterprise customer?";
const EMAIL_LABEL = "Notify the account team";

const buildDefinition = (teamMemberEmail: string) => ({
  schemaVersion: 1,
  trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {} },
  nodes: [
    {
      id: "enterprise-check",
      type: "if_else",
      label: IF_ELSE_LABEL,
      config: {
        condition: {
          id: "group",
          connector: "and",
          conditions: [
            {
              id: "plan-is-enterprise",
              left: { path: "payload.customer.plan" },
              operator: "equals",
              right: "enterprise",
            },
          ],
        },
      },
    },
    {
      id: "notify-team",
      type: "action",
      actionType: "send_email",
      label: EMAIL_LABEL,
      config: {
        // A literal recipient must be able to access the workspace: the workspace's owner is.
        to: teamMemberEmail,
        from: "noreply@example.com",
        replyTo: [],
        subject: "New enterprise sign-up",
        body: "<p>An enterprise customer just signed up.</p>",
        attachResponseData: false,
      },
    },
  ],
  edges: [
    { id: "trigger-to-check", source: "trigger", target: "enterprise-check" },
    { id: "check-then-notify", source: "enterprise-check", target: "notify-team", sourceHandle: "then" },
  ],
  entryNodeId: "trigger",
});

test.describe("Workflows", () => {
  test("a Webhook workflow's Test run takes its branch, and a call to its Secret URL runs it for real", async ({
    page,
    users,
    request,
  }) => {
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const email = `workflows-${stamp}@example.com`;
    const user = await users.create({ email, name: `workflows-${stamp}` });
    const { workspaceId } = user;
    if (!workspaceId) throw new Error("Workspace not seeded for the test user");
    await user.login();

    // The journey needs the `workflows` license feature, which CI's Enterprise license grants. Without
    // it the run fails here, naming the cause, rather than skipping or failing on a later step.
    const licensed = await test.step("the instance's license includes Workflows", () =>
      hasWorkflowsLicense(page.request, workspaceId));
    expect(
      licensed,
      "The instance's Enterprise license doesn't include Workflows: GET /api/v3/workflows answered 403 \"Workflows are not enabled for this organization\"."
    ).toBe(true);

    const workflowId = await test.step("seed a Webhook workflow through API v3", async () => {
      const response = await page.request.post("/api/v3/workflows", {
        headers: SAME_ORIGIN_HEADERS,
        data: { workspaceId, name: WORKFLOW_NAME, definition: buildDefinition(email) },
      });
      expect(response.status(), await response.text()).toBe(201);
      const { data } = (await response.json()) as { data: { id: string } };
      return data.id;
    });

    await test.step("a Test run with a pasted expected payload takes the Then branch", async () => {
      await page.goto(`/workspaces/${workspaceId}/workflows/${workflowId}`);

      // The trigger card on the canvas opens the Webhook trigger panel; its expected payload is what a
      // Test run sends (ADR 0052), and enabling needs one.
      await page.getByText("Starts when its Webhook Secret URL is called").click();
      await page.getByRole("button", { name: "Write or paste the expected payload" }).click();
      const expectedPayload = page.getByRole("textbox", { name: "Expected payload, JSON editor" });
      await expectedPayload.fill(JSON.stringify({ customer: { plan: "enterprise" } }));
      await expect(page.getByText(/^Saved: .*New calls don’t change these fields\.$/)).toBeVisible({
        timeout: 15_000,
      });

      // Test opens the Runs view's test form, ready to run; "Run test" starts it (review point 1).
      await page.getByRole("button", { name: "Test", exact: true }).click();
      await page.waitForURL(`**/workflows/${workflowId}/runs**`);
      const runTest = page.getByRole("button", { name: "Run test" });
      await expect(runTest).toBeFocused();
      await runTest.click();

      // The result shows in the Runs view, on the step whose panel was open (the trigger); "All steps"
      // goes back to the run's summary and its steps.
      const runPanel = page.getByTestId("workflow-run-panel");
      await expect(runPanel.getByRole("heading", { name: "Webhook trigger" })).toBeVisible();
      await runPanel.getByRole("button", { name: "All steps" }).click();
      await expect(runPanel.getByText("Test run · listed under Runs", { exact: false })).toBeVisible();
      await expect(runPanel.getByRole("listitem").filter({ hasText: IF_ELSE_LABEL })).toContainText(
        /customer\.plan is .enterprise. \(matched\) → Then/
      );
      await expect(runPanel.getByRole("listitem").filter({ hasText: EMAIL_LABEL })).toContainText(
        "Would send"
      );
      await page.getByRole("link", { name: "Editor" }).click();
      await page.waitForURL(`**/workflows/${workflowId}`);
    });

    await test.step("enable the workflow", async () => {
      await page.getByRole("button", { name: "Draft" }).click();
      await page.getByRole("menuitem", { name: "Enable" }).click();
      await expect(page.getByRole("button", { name: "Enabled" })).toBeVisible();
    });

    await test.step("a call to the Secret URL starts a real run", async () => {
      const webhook = await page.request.get(`/api/v3/workflows/${workflowId}/webhook`);
      expect(webhook.status(), await webhook.text()).toBe(200);
      const { data } = (await webhook.json()) as { data: { url: string } };

      // The caller's own request context: the Secret URL needs no session, only its token.
      const call = await request.post(data.url, { data: { customer: { plan: "starter" } } });
      expect(call.status(), await call.text()).toBe(202);
      const { runId } = (await call.json()) as { runId: string };

      // The app's queue worker runs it; the runs list does not refresh on its own.
      await expect
        .poll(
          async () => {
            const run = await page.request.get(`/api/v3/workflows/runs/${runId}`);
            return ((await run.json()) as { data?: { status: string } }).data?.status;
          },
          { message: "the run never completed", timeout: 30_000 }
        )
        .toBe("completed");
    });

    await test.step("Runs lists the real run beside the Test run, and Live filters it", async () => {
      await page.getByRole("link", { name: "Runs" }).click();
      await page.waitForURL(`**/workflows/${workflowId}/runs`);

      const runs = page.getByTestId("workflow-run-list").getByRole("listitem");
      await expect(runs).toHaveCount(2);
      await page.getByRole("group", { name: "Show runs" }).getByRole("button", { name: "Live" }).click();
      await expect(runs).toHaveCount(1);
      await expect(runs).toContainText("Completed");
      await expect(runs).not.toContainText("Test");

      // The newest listed run is the one shown.
      const runPanel = page.getByTestId("workflow-run-panel");
      await expect(runPanel.getByRole("listitem").filter({ hasText: IF_ELSE_LABEL })).toContainText(
        /customer\.plan is .enterprise. \(not matched\) → Else/
      );
      await expect(runPanel.getByRole("listitem").filter({ hasText: EMAIL_LABEL })).toContainText(
        "Not taken"
      );
    });
  });
});
