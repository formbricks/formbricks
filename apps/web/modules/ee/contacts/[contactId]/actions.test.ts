import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import {
  getOrganizationIdFromContactId,
  getWorkspaceIdFromContactId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
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
  getOrganizationIdFromContactId: vi.fn(),
  getWorkspaceIdFromContactId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
}));
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
  vi.mocked(getOrganizationIdFromContactId).mockResolvedValue("org_1");
  vi.mocked(getWorkspaceIdFromContactId).mockResolvedValue("ws_1");
  vi.mocked(getWorkspaceIdFromSurveyId).mockResolvedValue("ws_1");
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
