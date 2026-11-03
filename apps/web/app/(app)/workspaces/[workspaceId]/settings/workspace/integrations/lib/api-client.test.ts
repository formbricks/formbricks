import { afterEach, describe, expect, test, vi } from "vitest";
import { getIntegration, reviveIntegrationDates } from "./api-client";

const WORKSPACE_ID = "clws111111111111111111111";

describe("reviveIntegrationDates", () => {
  test("turns each mapping's JSON createdAt back into a Date and leaves the rest alone", () => {
    const revived = reviveIntegrationDates({
      id: "int_1",
      config: {
        email: "sheets@example.com",
        data: [{ spreadsheetName: "Responses", createdAt: "2026-01-01T00:00:00.000Z" }],
      },
    });

    expect(revived.config.data[0].createdAt).toBeInstanceOf(Date);
    expect((revived.config.data[0].createdAt as Date).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(revived.config.data[0].spreadsheetName).toBe("Responses");
    expect(revived.config.email).toBe("sheets@example.com");
  });
});

describe("getIntegration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches the workspace's integration of that type with revived dates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: "int_1", config: { data: [{ createdAt: "2026-01-01T00:00:00.000Z" }] } },
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const integration = await getIntegration({ workspaceId: WORKSPACE_ID, type: "googleSheets" });

    expect(fetchMock.mock.calls[0][0]).toBe(`/api/workspaces/${WORKSPACE_ID}/integrations/googleSheets`);
    expect(integration?.config.data[0].createdAt).toBeInstanceOf(Date);
  });

  test("returns null when the workspace has none", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null }))));

    expect(await getIntegration({ workspaceId: WORKSPACE_ID, type: "slack" })).toBeNull();
  });

  test("throws the parsed problem on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ title: "Forbidden", status: 403 }), {
          status: 403,
          headers: { "Content-Type": "application/problem+json" },
        })
      )
    );

    await expect(getIntegration({ workspaceId: WORKSPACE_ID, type: "notion" })).rejects.toBeTruthy();
  });
});
