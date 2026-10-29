import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  createOrganization,
  getCreateOrganizationErrorMessage,
  getNewOrganizationPath,
} from "./create-organization-client";

const fetchMock = vi.fn();

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

describe("createOrganization", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("posts the trimmed name to the v3 route and returns the created organization", async () => {
    fetchMock.mockResolvedValue(
      json(201, { data: { id: "org_new", name: "Acme", role: "owner", workspaceCount: 0 } })
    );

    const created = await createOrganization("  Acme ");

    expect(created).toEqual({ id: "org_new", name: "Acme" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v3/organizations");
    expect(init).toMatchObject({ method: "POST", cache: "no-store" });
    expect(JSON.parse(init.body)).toEqual({ name: "Acme" });
  });

  test.each([
    [403, "Multiple organizations need the multi-organization licence."],
    [429, "Too many requests. Try again later."],
  ])("a %s problem is thrown with the server's detail", async (status, detail) => {
    fetchMock.mockResolvedValue(json(status, { status, detail, code: "x", requestId: "req_1" }));

    const error = await createOrganization("Acme").catch((caught) => caught);

    expect(error).toBeInstanceOf(V3ApiError);
    expect(error).toMatchObject({ status, detail, requestId: "req_1" });
  });

  test("a 2xx answer that is not the expected shape is an error, never an undefined id", async () => {
    for (const body of [{}, { data: {} }, { data: { id: "", name: "x" } }, "nope"]) {
      fetchMock.mockResolvedValue(json(201, body));
      await expect(createOrganization("Acme")).rejects.toBeInstanceOf(V3ApiError);
    }
  });

  test("a network failure rejects with the original error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(createOrganization("Acme")).rejects.toThrow("Failed to fetch");
  });
});

describe("getNewOrganizationPath", () => {
  test("points at the organization's Connect page, escaping the id", () => {
    expect(getNewOrganizationPath("org_1")).toBe("/organizations/org_1");
    expect(getNewOrganizationPath("a/b")).toBe("/organizations/a%2Fb");
  });
});

describe("getCreateOrganizationErrorMessage", () => {
  const fallback = "Try again.";

  test("shows the server's detail for the refusals it wrote for the person", () => {
    for (const status of [400, 403, 429]) {
      expect(
        getCreateOrganizationErrorMessage(new V3ApiError({ status, detail: "Because." }), fallback)
      ).toBe("Because.");
    }
  });

  test("falls back for a server fault, an odd error and a non-error", () => {
    expect(
      getCreateOrganizationErrorMessage(new V3ApiError({ status: 500, detail: "stack" }), fallback)
    ).toBe(fallback);
    expect(getCreateOrganizationErrorMessage(new TypeError("Failed to fetch"), fallback)).toBe(fallback);
    expect(getCreateOrganizationErrorMessage(undefined, fallback)).toBe(fallback);
  });
});
