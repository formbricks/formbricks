import { CheckFailure, authFailure } from "../src/diagnostics.ts";
import { expect, tierTest } from "../src/fixtures.ts";
import { readState, updateState } from "../src/run-state.ts";
import { pickWritableWorkspace } from "../src/workspace.ts";

const test = tierTest("auth");

test.describe.configure({ mode: "serial" });

test("API key resolves to a workspace", async ({ api, config }) => {
  if (config.workspaceId) {
    updateState((state) => {
      state.workspaceId = config.workspaceId;
    });
    return;
  }

  const response = await api.get("/api/v2/me");
  if (response.status === 401 || response.status === 403) {
    throw new CheckFailure(
      "API key",
      `GET /api/v2/me returned HTTP ${response.status}; the key is invalid, or it has no organization access`,
      "if the key is scoped to one workspace only, set FORMBRICKS_WORKSPACE_ID; otherwise create a new key"
    );
  }
  if (!response.ok) throw authFailure(response.status, "(unresolved)");

  const workspaceId = pickWritableWorkspace(response.json);
  updateState((state) => {
    state.workspaceId = workspaceId;
  });
});

test("API key can read the workspace", async ({ api }) => {
  const { workspaceId } = readState();
  expect(workspaceId, "a workspace id from the previous step").toBeTruthy();

  const response = await api.get(`/api/v3/surveys?workspaceId=${workspaceId as string}&limit=1`);
  if (!response.ok) throw authFailure(response.status, workspaceId as string);
});
