import { authFailure } from "../src/diagnostics.ts";
import { tierTest } from "../src/fixtures.ts";
import { updateState } from "../src/run-state.ts";

const test = tierTest("auth");

test("API key can read the workspace", async ({ api, config }) => {
  updateState((state) => {
    state.workspaceId = config.workspaceId;
  });

  const response = await api.get(`/api/v3/surveys?workspaceId=${config.workspaceId}&limit=1`);
  if (!response.ok) throw authFailure(response.status, config.workspaceId);
});
