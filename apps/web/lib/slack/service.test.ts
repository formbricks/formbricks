import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SlackApiError } from "./errors";

const mocks = vi.hoisted(() => ({ getIntegrationByType: vi.fn(), deleteIntegration: vi.fn() }));

vi.mock("../integration/service", () => ({
  getIntegrationByType: mocks.getIntegrationByType,
  deleteIntegration: mocks.deleteIntegration,
}));

const { getSlackChannels } = await import("./service");

const slackIntegration = {
  id: "integration1",
  type: "slack",
  workspaceId: "ws1",
  config: { key: { access_token: "xoxb-token" }, data: [] },
};

const slackAnswers = (body: unknown, init: { status?: number } = {}) =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: init.status ?? 200 }))
  );

describe("getSlackChannels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIntegrationByType.mockResolvedValue(slackIntegration);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("lists the channels Slack returns", async () => {
    slackAnswers({ ok: true, channels: [{ id: "C1", name: "feedback", is_private: false }] });

    await expect(getSlackChannels("ws1")).resolves.toEqual([{ id: "C1", name: "feedback" }]);
  });

  test("rejects with Slack's own error code when Slack refuses", async () => {
    slackAnswers({ ok: false, error: "invalid_auth" });

    await expect(getSlackChannels("ws1")).rejects.toMatchObject({
      name: "SlackApiError",
      code: "invalid_auth",
    });
  });

  test("drops the integration when Slack reports its token expired", async () => {
    slackAnswers({ ok: false, error: "token_expired" });

    await expect(getSlackChannels("ws1")).rejects.toMatchObject({ code: "token_expired" });
    expect(mocks.deleteIntegration).toHaveBeenCalledWith("integration1");
  });

  test.each([
    ["an HTTP failure", () => slackAnswers({}, { status: 503 }), "http_503"],
    [
      "an unreachable Slack",
      () => vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed"))),
      "network_error",
    ],
    [
      "an answer that isn't JSON",
      () => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }))),
      "invalid_response",
    ],
    ["an answer without channels", () => slackAnswers({ ok: true }), "invalid_response"],
  ])("rejects with a SlackApiError for %s", async (_label, arrange, code) => {
    arrange();

    const error = await getSlackChannels("ws1").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SlackApiError);
    expect(error).toMatchObject({ code });
  });

  // An error of ours is not Slack's: wrapping it would answer a bug with a 502 instead of a 500.
  test("lets an error that isn't Slack's through unchanged", async () => {
    const bug = new TypeError("Cannot read properties of undefined");
    mocks.getIntegrationByType.mockRejectedValue(bug);

    await expect(getSlackChannels("ws1")).rejects.toBe(bug);
  });
});
