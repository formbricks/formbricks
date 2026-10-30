import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { deleteWorkspaceWithConfirmation, patchWorkspaceSettings } from "./api-client";

const WORKSPACE_ID = "clws111111111111111111111";
const URL = `/api/internal/workspaces/${WORKSPACE_ID}`;

const sentBody = () => JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body));

describe("workspace settings API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("PATCHes only the fields a form changes, sending a logo's baseline as an ISO timestamp", async () => {
    routeFetch({ [`PATCH ${URL}`]: [json({ data: { id: WORKSPACE_ID, name: "Acme" } })] });

    const updated = await patchWorkspaceSettings(WORKSPACE_ID, {
      logo: { url: "https://example.com/logo.png" },
      expectedUpdatedAt: new Date("2026-10-01T10:00:00.000Z"),
    });

    expect(updated).toEqual({ id: WORKSPACE_ID, name: "Acme" });
    expect(sentBody()).toEqual({
      logo: { url: "https://example.com/logo.png" },
      expectedUpdatedAt: "2026-10-01T10:00:00.000Z",
    });
  });

  test("surfaces a stale logo save as the server's message", async () => {
    const detail = "This workspace was changed somewhere else. Reload the page and try again.";
    routeFetch({ [`PATCH ${URL}`]: [json({ status: 409, detail }, 409)] });

    const failure = patchWorkspaceSettings(WORKSPACE_ID, { name: "Acme" });

    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 409, detail });
  });

  test("DELETEs with the typed name and answers the next destination", async () => {
    const destination = {
      workspaceId: "clws222222222222222222222",
      path: "/workspaces/clws222222222222222222222/",
    };
    routeFetch({ [`DELETE ${URL}`]: [json({ data: { destination } })] });

    expect(await deleteWorkspaceWithConfirmation(WORKSPACE_ID, "Acme")).toEqual({ destination });
    expect(sentBody()).toEqual({ confirmationName: "Acme" });
  });
});
