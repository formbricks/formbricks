import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, ValidationError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getContactInWorkspace } from "@/modules/ee/contacts/lib/contacts";
import { CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE } from "@/modules/ee/contacts/lib/personal-link-errors";
import { generatePersonalSurveyLinkAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: vi.fn().mockReturnThis(), action: vi.fn((fn) => fn) },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action, _target, fn) => fn),
}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
}));
vi.mock("@/modules/ee/contacts/lib/contacts", () => ({ getContactInWorkspace: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { actions: { stateMutation: {} } },
}));
vi.mock("@/modules/ee/contacts/lib/contact-survey-link", () => ({ getContactSurveyLink: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contacts-entitlement", () => ({ ensureContactsEnabled: vi.fn() }));

const generate = () =>
  (generatePersonalSurveyLinkAction as unknown as (args: object) => Promise<unknown>)({
    ctx: { user: { id: "user_1" }, auditLoggingCtx: {} },
    parsedInput: { contactId: "contact_1", surveyId: "survey_1" },
  });

/** Every workspace check passes; the survey-level one answers `surveyAllowed`. */
const actAs = (surveyAllowed: boolean) =>
  vi.mocked(assertCan).mockImplementation(async (_actor, _action, resource) => {
    if (resource.type === "survey" && !surveyAllowed) throw new AuthorizationError("Not authorized");
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_1");
  vi.mocked(getWorkspaceIdFromSurveyId).mockResolvedValue("ws_1");
  vi.mocked(getContactInWorkspace).mockResolvedValue({ id: "contact_1" } as never);
  vi.mocked(getContactSurveyLink).mockResolvedValue({ ok: true, data: "https://link" } as never);
});

describe("generatePersonalSurveyLinkAction (ENG-3282)", () => {
  test("mints no personal link for a survey the caller cannot write", async () => {
    actAs(false);

    await expect(generate()).rejects.toBeInstanceOf(AuthorizationError);
    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "survey.write", {
      type: "survey",
      id: "survey_1",
    });
    expect(getContactSurveyLink).not.toHaveBeenCalled();
  });

  test("mints the link for a survey the caller can write", async () => {
    actAs(true);

    await generate();
    expect(getContactSurveyLink).toHaveBeenCalledWith("contact_1", "survey_1", undefined);
  });
});

// The workspace comes from the survey, never from the contact, whose `workspaceId` only records where
// it was created. The contact must be in that workspace's contact directory.
describe("generatePersonalSurveyLinkAction: contact directory", () => {
  test("authorizes on the survey's workspace and looks the contact up in its directory", async () => {
    actAs(true);

    await generate();

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "workspace.write", {
      type: "workspace",
      id: "ws_1",
    });
    expect(getContactInWorkspace).toHaveBeenCalledWith("contact_1", "ws_1");
  });

  test("mints no link for a contact outside the survey workspace's directory", async () => {
    actAs(true);
    vi.mocked(getContactInWorkspace).mockResolvedValue(null);

    await expect(generate()).rejects.toThrow(
      new ValidationError(CONTACT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE)
    );
    expect(getContactSurveyLink).not.toHaveBeenCalled();
  });
});
