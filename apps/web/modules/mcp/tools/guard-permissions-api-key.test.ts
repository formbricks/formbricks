import { expect, test, vi } from "vitest";
import { z } from "zod";
import { registerMcpTool } from "./guard-permissions";
import { callToolOverHttp, errorText } from "./test-utils";

vi.mock("@/modules/auth/lib/oauth-urls", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/auth/lib/oauth-urls")>()),
  getMcpResourceUrl: () => "https://formbricks.test/api/mcp",
}));

test("names the missing API key permission when a read-only key calls a write tool", async () => {
  const writeChart = vi.fn();
  const outcome = await callToolOverHttp({
    registerTools: (server) =>
      registerMcpTool(
        server,
        "create_chart",
        { inputSchema: z.object({}), annotations: { readOnlyHint: false } },
        [{ permission: "charts", level: "write" }],
        writeChart
      ),
    authInfo: {
      token: "test-key",
      clientId: "key_ro",
      scopes: ["dashboards:read"],
      extra: {
        requestId: "req_api_key",
        formbricksAuthentication: { apiKeyId: "key_ro", organizationId: "org_1", workspacePermissions: [] },
      },
    },
    name: "create_chart",
    args: {},
  });

  expect(writeChart).not.toHaveBeenCalled();
  expect(outcome.result?.isError).toBe(true);
  expect(JSON.parse(errorText(outcome))).toEqual({
    error: {
      status: 403,
      title: "Forbidden",
      detail:
        "Not permitted: this API key lacks Charts: Write (dashboards:write). Use an API key with this access.",
      requestId: "req_api_key",
      code: "forbidden",
    },
  });
});
