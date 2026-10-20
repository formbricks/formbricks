import { CheckFailure } from "../src/diagnostics.ts";
import { tierTest } from "../src/fixtures.ts";
import { readState } from "../src/run-state.ts";
import { describeSdkBundleProblem } from "../src/sdk.ts";

const test = tierTest("sdk");

test("SDK environment endpoint answers", async ({ api }) => {
  const { workspaceId } = readState();
  const response = await api.get(`/api/v1/client/${workspaceId as string}/environment`, {
    authenticated: false,
    origin: "publicUrl",
  });

  const data = (response.json as { data?: unknown } | undefined)?.data;
  if (response.status !== 200 || typeof data !== "object" || data === null) {
    throw new CheckFailure(
      "SDK API",
      `GET /api/v1/client/<workspaceId>/environment returned HTTP ${response.status}`,
      "on split domains the client routes only exist on PUBLIC_URL; check the proxy forwards /api/v1/client/*"
    );
  }
});

test("SDK bundle is served", async ({ api }) => {
  const response = await api.get("/js/formbricks.umd.cjs", { authenticated: false, origin: "publicUrl" });

  const problem = describeSdkBundleProblem(response);
  if (problem) {
    throw new CheckFailure(
      "SDK bundle",
      `GET /js/formbricks.umd.cjs ${problem}`,
      "the image was built without the survey bundle, or the proxy blocks /js/*"
    );
  }
});
