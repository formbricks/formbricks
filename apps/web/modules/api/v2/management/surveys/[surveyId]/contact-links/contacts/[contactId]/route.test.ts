import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { handleApiError } from "@/modules/api/v2/lib/utils";
import { getWorkspaceId } from "@/modules/api/v2/management/lib/helper";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getContact } from "./lib/contacts";
import { getResponse } from "./lib/response";
import { getSurvey } from "./lib/surveys";
import { GET } from "./route";

vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn(async () => false) }));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromSurveyId: vi.fn(async () => "org-1") }));
vi.mock("@/modules/api/v2/auth/authenticated-api-client", () => ({ authenticatedApiClient: vi.fn() }));
vi.mock("@/modules/api/v2/lib/response", () => ({
  responses: { successResponse: vi.fn((body: unknown) => Response.json(body)) },
}));
vi.mock("@/modules/api/v2/lib/utils", () => ({ handleApiError: vi.fn() }));
vi.mock("@/modules/api/v2/management/lib/helper", () => ({ getWorkspaceId: vi.fn() }));
vi.mock("./lib/contacts", () => ({ getContact: vi.fn() }));
vi.mock("./lib/response", () => ({ getResponse: vi.fn() }));
vi.mock("./lib/surveys", () => ({ getSurvey: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contact-survey-link", () => ({ getContactSurveyLink: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn(async () => true) }));

const params = { surveyId: "survey-1", contactId: "contact-1" };
const request = new Request("http://localhost/api/v2/management/surveys/survey-1/contact-links/contacts/c");
const authentication = { apiKeyId: "key-1", type: "apiKey" };

/** A key's permission, as `can` answers it: "read" holds read actions only, "write" holds both. */
const grant = (level: "read" | "write") =>
  vi.mocked(can).mockImplementation(async (_actor, action) => {
    const name = String(action);
    return name.endsWith(".read") || level === "write";
  });

describe("GET /management/surveys/{surveyId}/contact-links/contacts/{contactId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticatedApiClient).mockImplementation(async ({ handler }) =>
      handler({ authentication, parsedInput: { params, query: {} }, request } as never)
    );
    vi.mocked(getWorkspaceId).mockResolvedValue({ ok: true, data: { workspaceId: "workspace-1" } } as never);
    vi.mocked(handleApiError).mockImplementation((_req, error) =>
      Response.json(error, { status: error.type === "unauthorized" ? 401 : 400 })
    );
    vi.mocked(getSurvey).mockResolvedValue({ ok: true, data: { id: "survey-1", type: "link" } } as never);
    vi.mocked(getContact).mockResolvedValue({ ok: true, data: { id: "contact-1" } } as never);
    vi.mocked(getResponse).mockResolvedValue({ ok: false, error: { type: "not_found" } } as never);
    vi.mocked(getContactSurveyLink).mockResolvedValue({ ok: true, data: "https://x/c/jwt" } as never);
  });

  test("refuses a read-only key and mints no link", async () => {
    grant("read");

    const response = await GET(request, { params: Promise.resolve(params) });

    expect(response.status).toBe(401);
    expect(getContactSurveyLink).not.toHaveBeenCalled();
  });

  test("requires write on the workspace and on the survey", async () => {
    grant("write");

    const response = await GET(request, { params: Promise.resolve(params) });

    expect(response.status).toBe(200);
    expect(vi.mocked(can).mock.calls.map(([, action, resource]) => [action, resource])).toEqual([
      ["workspace.write", { type: "workspace", id: "workspace-1" }],
      ["survey.write", { type: "survey", id: "survey-1" }],
    ]);
    expect(getContactSurveyLink).toHaveBeenCalledExactlyOnceWith("contact-1", "survey-1", undefined);
  });

  test("refuses a key that can write the workspace but not reach the survey", async () => {
    vi.mocked(can).mockImplementation(async (_actor, action) => action !== "survey.write");

    const response = await GET(request, { params: Promise.resolve(params) });

    expect(response.status).toBe(401);
    expect(getContactSurveyLink).not.toHaveBeenCalled();
  });
});
