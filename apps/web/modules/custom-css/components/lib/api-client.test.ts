import { afterEach, describe, expect, test, vi } from "vitest";
import { type TCustomCssError } from "@formbricks/types/custom-css";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  CustomCssApiError,
  getWorkspaceCustomCss,
  updateWorkspaceCustomCss,
  validateCustomCss,
} from "./api-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const problemResponse = (status: number, extra: Record<string, unknown> = {}): Response =>
  new Response(JSON.stringify({ title: "Error", status, detail: "Rejected", code: "bad", ...extra }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

const syntaxError: TCustomCssError = {
  code: "syntax_error",
  scope: "workspace",
  appearance: "dark",
  line: 3,
  column: 2,
  reason: "Unexpected token",
};

const resource = {
  workspaceId: "ws_1",
  customCss: { light: "#fbjs{}", dark: null },
  previous: null,
  status: "ok",
  canEdit: true,
  planAllowed: true,
};

describe("validateCustomCss", () => {
  test("posts the customCss operation and returns the compiled result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          valid: true,
          operation: "customCss",
          invalid_params: [],
          customCss: { light: "c", dark: null },
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;

    await expect(
      validateCustomCss({
        workspaceId: "ws_1",
        scope: "survey",
        surveyId: "s_1",
        input: { light: "a{}", dark: null },
        signal,
      })
    ).resolves.toEqual({ valid: true, compiled: { light: "c", dark: null }, warnings: [] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v3/surveys/validate");
    expect(init).toMatchObject({ method: "POST", signal });
    expect(JSON.parse(init.body)).toEqual({
      operation: "customCss",
      workspaceId: "ws_1",
      scope: "survey",
      surveyId: "s_1",
      data: { customCss: { light: "a{}", dark: null } },
    });
  });

  test("omits surveyId for workspace CSS", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { valid: false, errors: [syntaxError] } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateCustomCss({ workspaceId: "ws_1", scope: "workspace", input: { light: "a{", dark: null } })
    ).resolves.toEqual({ valid: false, errors: [syntaxError] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("surveyId");
  });

  test("reads located CSS errors from a rejected request as an invalid result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(problemResponse(422, { details: { errors: [syntaxError] } }))
    );

    await expect(
      validateCustomCss({ workspaceId: "ws_1", scope: "workspace", input: { light: "a{", dark: null } })
    ).resolves.toEqual({ valid: false, errors: [syntaxError] });
  });

  test("throws for a failure that is not about the CSS", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(problemResponse(403)));

    await expect(
      validateCustomCss({ workspaceId: "ws_1", scope: "workspace", input: { light: "a{}", dark: null } })
    ).rejects.toBeInstanceOf(V3ApiError);
  });
});

describe("workspace custom CSS resource", () => {
  test("GET reads the source-only resource", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: resource }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getWorkspaceCustomCss({ workspaceId: "ws_1" })).resolves.toEqual(resource);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/workspaces/ws_1/custom-css",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("PATCH sends source only and returns the warnings", async () => {
    const warning = { ...syntaxError, code: "import_removed" };
    // Warnings describe the write, not the resource, so they sit beside `data`.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: resource, warnings: [warning] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateWorkspaceCustomCss({ workspaceId: "ws_1", customCss: { light: "#fbjs{}", dark: null } })
    ).resolves.toEqual({ resource, warnings: [warning] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      customCss: { light: "#fbjs{}", dark: null },
    });
  });

  test("PATCH without CSS processing reports no warnings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: { ...resource, customCss: null } }))
    );

    await expect(updateWorkspaceCustomCss({ workspaceId: "ws_1", customCss: null })).resolves.toMatchObject({
      warnings: [],
    });
  });

  test("PATCH rejection carries the located CSS errors from the problem details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(problemResponse(422, { details: { errors: [syntaxError] } }))
    );

    const error = await updateWorkspaceCustomCss({ workspaceId: "ws_1", customCss: null }).catch((e) => e);
    expect(error).toBeInstanceOf(CustomCssApiError);
    expect(error.cssErrors).toEqual([syntaxError]);
    expect(error.detail).toBe("Rejected");
  });

  test("PATCH rejection without CSS errors is a plain V3ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(problemResponse(403, { code: "custom_css_plan_required" }))
    );

    const error = await updateWorkspaceCustomCss({ workspaceId: "ws_1", customCss: null }).catch((e) => e);
    expect(error).toBeInstanceOf(V3ApiError);
    expect(error).not.toBeInstanceOf(CustomCssApiError);
    expect(error.code).toBe("custom_css_plan_required");
  });
});
