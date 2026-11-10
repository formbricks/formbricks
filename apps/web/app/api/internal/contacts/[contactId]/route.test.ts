import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, ResourceNotFoundError, TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { MAX_CONTACT_ATTRIBUTES_PER_REQUEST } from "@/lib/constants";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE } from "@/modules/ee/contacts/lib/personal-link-errors";
import { CONTACT_ATTRIBUTE_VALUE_MAX_LENGTH } from "../schemas";
import { PUT } from "./attributes/route";
import { POST } from "./personal-links/route";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  capturePostHogEvent: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  getOrganizationIdFromContactId: vi.fn(),
  getWorkspaceIdFromContactId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  deleteContact: vi.fn(),
  getContact: vi.fn(),
  updateContactAttributes: vi.fn(),
  getContactSurveyLink: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can, assertCan: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromContactId: mocks.getOrganizationIdFromContactId,
  getWorkspaceIdFromContactId: mocks.getWorkspaceIdFromContactId,
  getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: mocks.getIsContactsEnabled }));
vi.mock("@/modules/ee/contacts/lib/contacts", () => ({
  deleteContact: mocks.deleteContact,
  getContact: mocks.getContact,
}));
vi.mock("@/modules/ee/contacts/lib/update-contact-attributes", () => ({
  updateContactAttributes: mocks.updateContactAttributes,
}));
vi.mock("@/modules/ee/contacts/lib/contact-survey-link", () => ({
  getContactSurveyLink: mocks.getContactSurveyLink,
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    targetId: "unknown",
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const OTHER_WORKSPACE_ID = "clwork2222222222222222222";
const CONTACT_ID = "clcontact1111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const BASE = `http://localhost/api/internal/contacts/${CONTACT_ID}`;
const props = { params: Promise.resolve({ contactId: CONTACT_ID }) } as never;

const storedContact = { id: CONTACT_ID, workspaceId: WORKSPACE_ID };

const send = (method: "PUT" | "POST", url: string, body: unknown, headers = SAME_ORIGIN_HEADERS) =>
  new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const remove = (headers: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  DELETE(new NextRequest(BASE, { method: "DELETE", headers }), props);
const saveAttributes = (body: unknown) => PUT(send("PUT", `${BASE}/attributes`, body), props);
const createLink = (body: unknown = { surveyId: SURVEY_ID }) =>
  POST(send("POST", `${BASE}/personal-links`, body), props);

const checkedActions = () => mocks.can.mock.calls.map(([, action, resource]) => [action, resource]);
const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getIsContactsEnabled.mockResolvedValue(true);
  mocks.getOrganizationIdFromContactId.mockResolvedValue(ORG_ID);
  mocks.getWorkspaceIdFromContactId.mockResolvedValue(WORKSPACE_ID);
  mocks.getWorkspaceIdFromSurveyId.mockResolvedValue(WORKSPACE_ID);
  mocks.deleteContact.mockResolvedValue(storedContact);
  mocks.getContact.mockResolvedValue(storedContact);
  mocks.updateContactAttributes.mockResolvedValue({ updatedAttributes: { email: "ada@example.com" } });
  mocks.getContactSurveyLink.mockResolvedValue({ ok: true, data: "https://f.test/c/token" });
});

describe("the contact write gate, shared by every route", () => {
  test.each([
    ["DELETE", () => remove()],
    ["PUT attributes", () => saveAttributes({ attributes: { email: "ada@example.com" } })],
    ["POST personal-links", () => createLink()],
  ])("%s authorizes the contact's workspace, then the budget, then the licence", async (_label, call) => {
    await call();
    expect(checkedActions()[0]).toEqual(["workspace.write", { type: "workspace", id: WORKSPACE_ID }]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.getIsContactsEnabled).toHaveBeenCalledWith(ORG_ID);
  });

  test("answers the uniform 403 to a caller who can't write the workspace, before the budget and licence", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await remove();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(operationLimits()).toEqual([]);
    expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
    expect(mocks.deleteContact).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a contact that doesn't exist", async () => {
    mocks.getOrganizationIdFromContactId.mockRejectedValue(new ResourceNotFoundError("contact", CONTACT_ID));

    const response = await remove();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.can).not.toHaveBeenCalled();
  });

  test("refuses where Contacts isn't licensed, with the reason, after the budget", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(false);

    const response = await remove();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Contacts are not enabled for this organization");
    expect(operationLimits()).toHaveLength(1);
    expect(mocks.deleteContact).not.toHaveBeenCalled();
  });

  test("answers 429 when the workspace's write budget is spent", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60);
      }
    });

    expect((await remove()).status).toBe(429);
    expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
    expect(mocks.deleteContact).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await remove({ "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(mocks.deleteContact).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await remove()).status).toBe(401);
  });
});

describe("DELETE /api/internal/contacts/{contactId}", () => {
  test("deletes the contact and audits it with the deleted contact", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(mocks.deleteContact).toHaveBeenCalledWith(CONTACT_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "contact",
        targetId: CONTACT_ID,
        organizationId: ORG_ID,
        status: "success",
        oldObject: storedContact,
      })
    );
  });
});

describe("PUT /api/internal/contacts/{contactId}/attributes", () => {
  test("saves the attributes, answers the save's messages and audits the attributes as saved", async () => {
    const messages = [{ code: "email_already_exists", params: {} }];
    mocks.updateContactAttributes.mockResolvedValue({
      updatedAttributes: { email: "ada@example.com", plan: "pro" },
      messages,
    });

    const response = await saveAttributes({
      attributes: { email: "ada@example.com", plan: "pro", seats: 3 },
    });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ contactId: CONTACT_ID, messages });
    expect(mocks.updateContactAttributes).toHaveBeenCalledWith(CONTACT_ID, {
      email: "ada@example.com",
      plan: "pro",
      seats: 3,
    });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "contact",
        targetId: CONTACT_ID,
        organizationId: ORG_ID,
        status: "success",
        newObject: { contactId: CONTACT_ID, attributes: { email: "ada@example.com", plan: "pro" } },
      })
    );
  });

  test("answers no messages when everything was saved as sent", async () => {
    const response = await saveAttributes({ attributes: { email: "ada@example.com" } });
    expect((await response.json()).data.messages).toEqual([]);
  });

  test("answers the uniform 403 for a contact deleted meanwhile", async () => {
    mocks.getContact.mockResolvedValue(null);

    expect((await saveAttributes({ attributes: {} })).status).toBe(403);
    expect(mocks.updateContactAttributes).not.toHaveBeenCalled();
  });

  test("answers 422 with the service's reason for a save it can't take", async () => {
    mocks.updateContactAttributes.mockRejectedValue(new InvalidInputError("Invalid attributes"));

    const response = await saveAttributes({ attributes: { email: "ada@example.com" } });

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("Invalid attributes");
  });

  test.each([
    ["no attributes", {}],
    ["attributes that aren't a map", { attributes: ["email"] }],
    ["an object value", { attributes: { plan: { tier: "pro" } } }],
    ["a value past the cap", { attributes: { plan: "a".repeat(CONTACT_ATTRIBUTE_VALUE_MAX_LENGTH + 1) } }],
    ["a key past the cap", { attributes: { ["a".repeat(256)]: "pro" } }],
    [
      "more attributes than a request may carry",
      {
        attributes: Object.fromEntries(
          Array.from({ length: MAX_CONTACT_ATTRIBUTES_PER_REQUEST + 1 }, (_, index) => [`key_${index}`, "v"])
        ),
      },
    ],
    ["an unknown key", { attributes: {}, contactId: CONTACT_ID }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await saveAttributes(body)).status).toBe(400);
    expect(mocks.updateContactAttributes).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/contacts/{contactId}/personal-links", () => {
  test("mints the link, captures it in PostHog and audits it on the contact with the survey", async () => {
    const response = await createLink({ surveyId: SURVEY_ID, expirationDays: 7 });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ surveyUrl: "https://f.test/c/token" });
    expect(checkedActions()).toEqual([
      ["workspace.write", { type: "workspace", id: WORKSPACE_ID }],
      ["survey.write", { type: "survey", id: SURVEY_ID }],
    ]);
    expect(mocks.getContactSurveyLink).toHaveBeenCalledWith(CONTACT_ID, SURVEY_ID, 7);
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "personal_link_created",
      { organization_id: ORG_ID, workspace_id: WORKSPACE_ID, survey_id: SURVEY_ID },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "contact",
        targetId: CONTACT_ID,
        organizationId: ORG_ID,
        status: "success",
        newObject: { surveyId: SURVEY_ID },
      })
    );
  });

  test("makes a link that doesn't expire when no expiry is sent", async () => {
    await createLink();
    expect(mocks.getContactSurveyLink).toHaveBeenCalledWith(CONTACT_ID, SURVEY_ID, undefined);
  });

  // ENG-3282: a personal link writes responses into the survey.
  test("mints no link for a survey the caller can't write", async () => {
    mocks.can.mockImplementation(
      async (_actor, _action, resource: { type: string }) => resource.type !== "survey"
    );

    const response = await createLink();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.getContactSurveyLink).not.toHaveBeenCalled();
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("answers 422 with the code the dialog translates for a survey in another workspace", async () => {
    mocks.getWorkspaceIdFromSurveyId.mockResolvedValue(OTHER_WORKSPACE_ID);

    const response = await createLink();

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe(CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE);
    expect(checkedActions()).toEqual([["workspace.write", { type: "workspace", id: WORKSPACE_ID }]]);
    expect(mocks.getContactSurveyLink).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a survey that doesn't exist", async () => {
    mocks.getWorkspaceIdFromSurveyId.mockRejectedValue(new ResourceNotFoundError("survey", SURVEY_ID));
    expect((await createLink()).status).toBe(403);
    expect(mocks.getContactSurveyLink).not.toHaveBeenCalled();
  });

  test.each([
    ["not_found", undefined, 403, "You are not authorized to access this resource"],
    [
      "bad_request",
      [{ field: "surveyId", issue: "Survey is not a link survey" }],
      422,
      "Survey is not a link survey",
    ],
    ["bad_request", undefined, 422, "Invalid request"],
    ["internal_server_error", undefined, 422, "Failed to generate personal survey link"],
  ])("answers a %s link failure with %s", async (type, details, status, detail) => {
    mocks.getContactSurveyLink.mockResolvedValue({ ok: false, error: { type, details } });

    const response = await createLink();

    expect(response.status).toBe(status);
    expect((await response.json()).detail).toBe(detail);
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
  });

  test.each([
    ["no survey", {}],
    ["a survey that isn't an id", { surveyId: "survey-1" }],
    ["a fractional number of days", { surveyId: SURVEY_ID, expirationDays: 1.5 }],
    ["zero days", { surveyId: SURVEY_ID, expirationDays: 0 }],
    ["more than a century", { surveyId: SURVEY_ID, expirationDays: 36_501 }],
    ["an unknown key", { surveyId: SURVEY_ID, contactId: CONTACT_ID }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await createLink(body)).status).toBe(400);
    expect(mocks.getContactSurveyLink).not.toHaveBeenCalled();
  });
});
