import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { hasWorkflowsLicense } from "./utils/license";

/**
 * The Workflows journey (ENG-7183): the one place the editor, a Test run's fake effects, the Webhook
 * Secret URL, the run queue and the runs list meet. A Webhook workflow with an If/else is seeded
 * through API v3; in the editor a test payload takes the Then branch and the email "would send"; once
 * enabled, a real call to the Secret URL starts a run that takes the Else branch and shows under Runs,
 * where Test runs are hidden by default.
 *
 * The real call takes the Else branch, which is empty, so the run sends no email: the journey needs no
 * mail server, and the Then branch's email is proven by the Test run.
 *
 * The instance's Enterprise license must include Workflows; the journey checks that first.
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

    const licensed = await test.step("the instance's license includes Workflows", () =>
      hasWorkflowsLicense(page.request, workspaceId));
    // TEMPORARY (ENG-2553): CI's license grants `contacts` but not `workflows`, so every workflow route
    // answers 403 there. Once it has the flag, replace this skip with `expect(licensed).toBe(true)`, so
    // a license without Workflows fails the journey instead of hiding it.
    test.skip(!licensed, "The instance's Enterprise license doesn't include Workflows (403)");

    const workflowId = await test.step("seed a Webhook workflow through API v3", async () => {
      const response = await page.request.post("/api/v3/workflows", {
        data: { workspaceId, name: WORKFLOW_NAME, definition: buildDefinition(email) },
      });
      expect(response.status(), await response.text()).toBe(201);
      const { data } = (await response.json()) as { data: { id: string } };
      return data.id;
    });

    await test.step("a Test run with a pasted payload takes the Then branch", async () => {
      await page.goto(`/workspaces/${workspaceId}/workflows/${workflowId}`);

      // The trigger card on the canvas opens the Webhook trigger panel.
      await page.getByText("Starts when its Webhook Secret URL is called").click();
      const testPayload = page.getByRole("textbox", { name: "Test payload, JSON editor" });
      await testPayload.fill(JSON.stringify({ customer: { plan: "enterprise" } }));

      await page.getByRole("button", { name: "Test run" }).click();

      const drawer = page.getByRole("dialog");
      await expect(drawer.getByRole("heading", { name: `Run · ${WORKFLOW_NAME}` })).toContainText("Test");
      await expect(drawer.getByRole("listitem").filter({ hasText: IF_ELSE_LABEL })).toContainText(
        "customer.plan is enterprise (matched) → Then"
      );
      await expect(drawer.getByRole("listitem").filter({ hasText: EMAIL_LABEL })).toContainText("Would send");
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
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

    await test.step("Runs lists the real run and hides the Test run", async () => {
      await page.getByRole("link", { name: "Runs" }).click();
      await page.waitForURL(`**/workflows/${workflowId}/runs`);

      const runs = page.getByRole("table").getByRole("button");
      await expect(runs).toHaveCount(1);
      await expect(runs).toContainText("Webhook");
      await expect(runs).toContainText("Completed");
      await expect(runs).not.toContainText("Test");

      await runs.click();
      const drawer = page.getByRole("dialog");
      await expect(drawer.getByRole("listitem").filter({ hasText: IF_ELSE_LABEL })).toContainText(
        "customer.plan is enterprise (not matched) → Else"
      );
      await expect(drawer.getByRole("listitem").filter({ hasText: EMAIL_LABEL })).toContainText("Not taken");
    });
  });
});
