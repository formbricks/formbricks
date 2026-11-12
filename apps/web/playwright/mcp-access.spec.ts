import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import {
  MCP_CLIENT_REDIRECT_URI,
  callMcpTool,
  exchangeMcpCode,
  expectToolRefused,
  expectToolSucceeded,
  refreshMcpToken,
  registerMcpClient,
  startMcpAuthorization,
} from "./utils/mcp";

/**
 * MCP access (ENG-7154, "5. Engineering spec" seam 3; GLOSSARY.md "MCP access"): a user connects an MCP
 * client through the real OAuth flow and consent screen, limits it to one workspace and Read-only, then
 * widens it on Authorized apps and finally revokes it, and every change shows on the client's next tool
 * call with the token it already holds. The per-permission, per-tool and per-access-mode matrix is proven
 * against `/api/mcp` in `modules/mcp/*.integration.test.ts`; this journey is what only exists once the
 * browser, the consent screen, Authorized apps, the MCP route and SpiceDB are wired together.
 *
 * One journey in `test.step` phases: each phase starts from the grant the previous one left.
 */

const stamp = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

/** `patch_survey` validates against the v3 contract, which needs at least one block. */
const BLOCKS = [
  {
    id: "clbk1234567890123456789099",
    name: "Main Block",
    elements: [
      {
        id: "improve",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

test.describe("MCP access", () => {
  test("connects a client read-only to one workspace, raises a level on Authorized apps, then revokes it", async ({
    page,
    users,
    request,
  }) => {
    const run = stamp();
    const pickedName = `Picked ${run}`;
    const clientName = `MCP client ${run}`;
    const user = await users.create({ name: `mcp-${run}`, workspaceName: pickedName, skipSurveySeed: true });
    const pickedWorkspaceId = user.workspaceId as string;
    const other = await prisma.workspace.create({
      data: { name: `Other ${run}`, organizationId: user.organizationId },
    });
    const [pickedSurvey, otherSurvey] = await Promise.all(
      [pickedWorkspaceId, other.id].map((workspaceId) =>
        prisma.survey.create({
          data: { name: "MCP survey", type: "link", status: "draft", workspaceId, blocks: BLOCKS as never },
        })
      )
    );
    await user.login();

    const client = await registerMcpClient(request, clientName);
    let tokens = { access_token: "", refresh_token: "" };

    await test.step("connect through the consent screen: Only selected workspaces, one picked, Read-only", async () => {
      const { url, verifier } = startMcpAuthorization(client);
      // Nothing listens on the loopback redirect, as for a desktop client that is not running; answer it so
      // the browser lands somewhere. The code is read off the redirect request below.
      await page.route(`${MCP_CLIENT_REDIRECT_URI}**`, (route) =>
        route.fulfill({ status: 200, contentType: "text/plain", body: "Connected" })
      );
      await page.goto(url);
      await expect(page).toHaveURL(/\/account\/authorize/);

      await page
        .getByRole("radiogroup", { name: "Organization & workspace access" })
        .getByText("Only selected workspaces", { exact: true })
        .click();
      await page.getByPlaceholder("Pick workspaces").click();
      await page.getByRole("option", { name: pickedName }).click();
      await page.getByRole("button", { name: "Read-only" }).click();
      await expect(
        page
          .getByRole("radiogroup", { name: "Access level for Surveys" })
          .getByRole("radio", { name: "Read" })
      ).toBeChecked();

      const redirect = page.waitForRequest((sent) => sent.url().startsWith(MCP_CLIENT_REDIRECT_URI));
      await page.getByRole("button", { name: "Allow access" }).click();
      const callbackUrl = new URL((await redirect).url());
      const code = callbackUrl.searchParams.get("code");
      expect(code, callbackUrl.href).toBeTruthy();
      // No wait for the outbox: Allow writes the workspace selection to SpiceDB before it redirects
      // (ENG-7153), so the first call already sees it.
      tokens = await exchangeMcpCode(request, client, code as string, verifier);
    });

    await test.step("the token reads in the picked workspace only, and a write is not permitted", async () => {
      const read = expectToolSucceeded<{ id: string }>(
        await callMcpTool(request, tokens.access_token, "get_survey", { surveyId: pickedSurvey.id })
      );
      expect(JSON.stringify(read)).toContain(pickedSurvey.id);

      const workspaces = expectToolSucceeded<{ data: { id: string }[] }>(
        await callMcpTool(request, tokens.access_token, "list_workspaces", {})
      );
      expect(workspaces.data.map(({ id }) => id)).toEqual([pickedWorkspaceId]);

      expect(
        expectToolRefused(
          await callMcpTool(request, tokens.access_token, "get_survey", { surveyId: otherSurvey.id })
        )
      ).toMatchObject({ status: 404, code: "not_found" });

      const write = expectToolRefused(
        await callMcpTool(request, tokens.access_token, "patch_survey", {
          surveyId: pickedSurvey.id,
          data: { name: `Renamed ${run}` },
        })
      );
      expect(write).toMatchObject({ status: 403, code: "forbidden" });
      expect(write.detail).toMatch(/^Not permitted: /);
    });

    const row = page.getByRole("row").filter({ hasText: clientName });

    await test.step("Authorized apps lists the client with 1 workspace and Read, and Edit raises Surveys to Write", async () => {
      await page.goto("/account/settings/authorized-apps");
      await expect(row.getByText("1 workspace", { exact: true })).toBeVisible();
      await expect(row.getByText("Surveys · Read")).toBeVisible();

      await row.getByRole("button", { name: `Edit ${clientName}'s access` }).click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("radiogroup", { name: "Access level for Surveys" })
        .getByText("Write", { exact: true })
        .click();
      await expect(
        dialog
          .getByRole("radiogroup", { name: "Access level for Surveys" })
          .getByRole("radio", { name: "Write" })
      ).toBeChecked();
      await dialog.getByRole("button", { name: "Save changes" }).click();
      await expect(dialog).toBeHidden();
      await expect(row.getByText("Surveys · Write")).toBeVisible();
    });

    await test.step("the next call writes with the same token, without reconnecting", async () => {
      expectToolSucceeded(
        await callMcpTool(request, tokens.access_token, "patch_survey", {
          surveyId: pickedSurvey.id,
          data: { name: `Renamed ${run}` },
        })
      );
      await expect
        .poll(async () => (await prisma.survey.findUniqueOrThrow({ where: { id: pickedSurvey.id } })).name)
        .toBe(`Renamed ${run}`);
    });

    await test.step("Revoke, and the next call with the same token is refused", async () => {
      page.once("dialog", (confirm) => confirm.accept());
      await row.getByRole("button", { name: "Revoke" }).click();
      await expect(row).toHaveCount(0);

      const refused = await callMcpTool(request, tokens.access_token, "get_survey", {
        surveyId: pickedSurvey.id,
      });
      expect(refused.status).toBe(401);
      expect((await refreshMcpToken(request, client, tokens.refresh_token)).ok()).toBe(false);
    });
  });
});
