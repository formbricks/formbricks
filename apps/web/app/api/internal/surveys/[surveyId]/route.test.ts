import {
  SAVED_SURVEY_ID as SURVEY_ID,
  SAVED_SURVEY_WORKSPACE_ID as WORKSPACE_ID,
  buildSavedSurvey,
} from "@/modules/survey/editor/lib/__mocks__/saved-survey.mock";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
  UniqueConstraintError,
  ValidationError,
} from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { SurveyLinkedCreativesError } from "@/modules/ee/creatives/lib/linked-creatives";
import { PUT as PUT_DRAFT } from "./draft/route";
import {
  SURVEY_SAVE_MAX_ARRAY_ITEMS,
  SURVEY_SAVE_MAX_BODY_BYTES,
  SURVEY_SAVE_MAX_INT_COLUMN,
  SURVEY_SAVE_MAX_OBJECT_KEYS,
  SURVEY_SAVE_MAX_STRING_LENGTH,
} from "./lib/limits";
import { PUT } from "./route";

const mocks = vi.hoisted(() => ({
  constants: { POSTHOG_KEY: "phc_test" as string | undefined, IS_FORMBRICKS_SURVEYS_CONFIGURED: false },
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  capturePostHogEvent: vi.fn(),
  revalidatePath: vi.fn(),
  getOrganizationIdFromSurveyId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  checkSpamProtectionPermission: vi.fn(),
  getSurvey: vi.fn(),
  getOrganizationBilling: vi.fn(),
  getSurveyFollowUpsPermission: vi.fn(),
  checkExternalUrlsPermission: vi.fn(),
  updateSurvey: vi.fn(),
  updateSurveyDraft: vi.fn(),
  resolveSurveyActorContext: vi.fn(),
  getSurveyCount: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    get POSTHOG_KEY() {
      return mocks.constants.POSTHOG_KEY;
    },
    get IS_FORMBRICKS_SURVEYS_CONFIGURED() {
      return mocks.constants.IS_FORMBRICKS_SURVEYS_CONFIGURED;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromSurveyId: mocks.getOrganizationIdFromSurveyId,
  getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId,
}));
vi.mock("@/lib/survey/visibility/actor-context", () => ({
  resolveSurveyActorContext: mocks.resolveSurveyActorContext,
}));
vi.mock("@/modules/survey/lib/permission", () => ({
  checkSpamProtectionPermission: mocks.checkSpamProtectionPermission,
}));
vi.mock("@/modules/survey/lib/survey", () => ({
  getSurvey: mocks.getSurvey,
  getOrganizationBilling: mocks.getOrganizationBilling,
}));
vi.mock("@/modules/survey/follow-ups/lib/utils", () => ({
  getSurveyFollowUpsPermission: mocks.getSurveyFollowUpsPermission,
}));
vi.mock("@/modules/survey/editor/lib/check-external-urls-permission", () => ({
  checkExternalUrlsPermission: mocks.checkExternalUrlsPermission,
}));
vi.mock("@/modules/survey/editor/lib/survey", () => ({
  updateSurvey: mocks.updateSurvey,
  updateSurveyDraft: mocks.updateSurveyDraft,
}));
vi.mock("@/modules/survey/list/lib/survey", () => ({ getSurveyCount: mocks.getSurveyCount }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const ACTOR_CONTEXT = { kind: "user", userId: USER_ID };

type TRoute = typeof PUT;

const ROUTES = [
  ["PUT /api/internal/surveys/{surveyId}", PUT, `http://localhost/api/internal/surveys/${SURVEY_ID}`],
  [
    "PUT /api/internal/surveys/{surveyId}/draft",
    PUT_DRAFT,
    `http://localhost/api/internal/surveys/${SURVEY_ID}/draft`,
  ],
] as const;

/** Sends `body` as the editor does: JSON, so every date travels as an ISO string. */
const send = (
  route: TRoute,
  url: string,
  body: unknown,
  { id = SURVEY_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}
) =>
  route(
    new NextRequest(url.replace(SURVEY_ID, id), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ surveyId: id }) } as never
  );

const save = (body: unknown, options?: Parameters<typeof send>[3]) => send(PUT, ROUTES[0][2], body, options);
const saveDraft = (body: unknown, options?: Parameters<typeof send>[3]) =>
  send(PUT_DRAFT, ROUTES[1][2], body, options);

/** The stored survey a save is checked against: live, unless a test says otherwise. */
const storedSurvey = (overrides: Partial<TSurvey> = {}) =>
  buildSavedSurvey({ status: "inProgress", publishOn: null, closeOn: null, ...overrides });

const checkedActions = () => mocks.can.mock.calls.map(([, action, resource]) => [action, resource]);

const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

const events = () => mocks.capturePostHogEvent.mock.calls.map(([, event]) => event);

const problem = async (response: Response) => (await response.json()) as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.constants.POSTHOG_KEY = "phc_test";
  mocks.constants.IS_FORMBRICKS_SURVEYS_CONFIGURED = false;
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getOrganizationIdFromSurveyId.mockResolvedValue(ORG_ID);
  mocks.getWorkspaceIdFromSurveyId.mockResolvedValue(WORKSPACE_ID);
  mocks.getSurvey.mockResolvedValue(storedSurvey());
  mocks.getOrganizationBilling.mockResolvedValue({ plan: "free" });
  mocks.getSurveyFollowUpsPermission.mockResolvedValue(true);
  mocks.checkExternalUrlsPermission.mockResolvedValue(undefined);
  mocks.checkSpamProtectionPermission.mockResolvedValue(undefined);
  mocks.resolveSurveyActorContext.mockResolvedValue(ACTOR_CONTEXT);
  mocks.updateSurvey.mockImplementation(async (survey: TSurvey) => ({ ...survey, updatedAt: new Date() }));
  mocks.updateSurveyDraft.mockImplementation(async (survey: TSurvey) => ({
    ...survey,
    updatedAt: new Date(),
  }));
  mocks.getSurveyCount.mockResolvedValue(2);
});

describe("PUT /api/internal/surveys/{surveyId}", () => {
  test("saves the survey for an editor, in the action's order of checks, audited and revalidated", async () => {
    const survey = buildSavedSurvey({ status: "inProgress" });
    const response = await save(survey);

    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toMatchObject({ id: SURVEY_ID, name: survey.name, isSecondPublish: false });
    expect(checkedActions()[0]).toEqual(["survey.write", { type: "survey", id: SURVEY_ID }]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.updateSurvey).toHaveBeenCalledWith(expect.objectContaining({ id: SURVEY_ID }), {
      customCssPrincipal: USER_ID,
      targetingActor: ACTOR_CONTEXT,
    });
    expect(mocks.resolveSurveyActorContext).toHaveBeenCalledWith({ type: "user", id: USER_ID }, ORG_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "survey",
        status: "success",
        organizationId: ORG_ID,
        targetId: SURVEY_ID,
        oldObject: expect.objectContaining({ id: SURVEY_ID, status: "inProgress" }),
        newObject: expect.objectContaining({ id: SURVEY_ID, name: survey.name }),
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/surveys/${SURVEY_ID}`);
  });

  test("revives every date the survey carries before ZSurvey and the write read it", async () => {
    const survey = buildSavedSurvey({ status: "inProgress" });

    expect((await save(survey)).status).toBe(200);

    const written = mocks.updateSurvey.mock.calls[0][0] as TSurvey;
    expect(written.createdAt).toEqual(survey.createdAt);
    expect(written.publishOn).toEqual(survey.publishOn);
    expect(written.closeOn).toEqual(survey.closeOn);
    expect(written.languages[0].language.createdAt).toEqual(survey.languages[0].language.createdAt);
    expect(written.triggers[0].actionClass.updatedAt).toBeInstanceOf(Date);
    expect(written.segment?.createdAt).toEqual(survey.segment?.createdAt);
    expect(written.followUps[0].createdAt).toEqual(survey.followUps[0].createdAt);
  });

  test("refuses a date that is not one, as the action's schema did", async () => {
    const response = await save({ ...JSON.parse(JSON.stringify(buildSavedSurvey())), publishOn: "soon" });

    expect(response.status).toBe(400);
    expect(mocks.updateSurvey).not.toHaveBeenCalled();
  });

  test("validates the survey in full, as the action did", async () => {
    const response = await save({ ...buildSavedSurvey(), blocks: [] });

    expect(response.status).toBe(400);
    expect(mocks.updateSurvey).not.toHaveBeenCalled();
  });

  describe("PostHog", () => {
    test("a draft published sends survey_published and survey_updated", async () => {
      mocks.getSurvey.mockResolvedValue(storedSurvey({ status: "draft" }));

      await save(buildSavedSurvey({ status: "inProgress" }));

      expect(events()).toEqual(["survey_published", "survey_updated"]);
      expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
        USER_ID,
        "survey_published",
        {
          survey_id: SURVEY_ID,
          survey_type: "link",
          question_count: 1,
          organization_id: ORG_ID,
          workspace_id: WORKSPACE_ID,
          has_targeting: false,
          language_count: 1,
        },
        { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
      );
    });

    test("a live survey saved sends survey_updated only, and a draft saved sends nothing", async () => {
      await save(buildSavedSurvey({ status: "inProgress" }));
      expect(events()).toEqual(["survey_updated"]);

      mocks.capturePostHogEvent.mockClear();
      mocks.getSurvey.mockResolvedValue(storedSurvey({ status: "draft" }));
      await save(buildSavedSurvey({ status: "draft" }));
      expect(events()).toEqual([]);
    });

    test("sends nothing without a PostHog key", async () => {
      mocks.constants.POSTHOG_KEY = undefined;
      mocks.getSurvey.mockResolvedValue(storedSurvey({ status: "draft" }));

      await save(buildSavedSurvey({ status: "inProgress" }));

      expect(events()).toEqual([]);
    });

    test("sends the edit events for what the save added, against the stored survey", async () => {
      mocks.getSurvey.mockResolvedValue(storedSurvey({ followUps: [] }));

      await save(
        buildSavedSurvey({ status: "inProgress", hiddenFields: { enabled: true, fieldIds: ["ref"] } })
      );

      expect(events()).toEqual(["hidden_field_added", "follow_up_added", "survey_updated"]);
    });
  });

  describe("isSecondPublish", () => {
    beforeEach(() => {
      mocks.constants.IS_FORMBRICKS_SURVEYS_CONFIGURED = true;
      mocks.getSurvey.mockResolvedValue(storedSurvey({ status: "draft" }));
    });

    test("is true when this publish is the user's second, counted over their own surveys", async () => {
      const { data } = await (await save(buildSavedSurvey({ status: "inProgress" }))).json();

      expect(data.isSecondPublish).toBe(true);
      expect(mocks.getSurveyCount).toHaveBeenCalledWith(
        WORKSPACE_ID,
        { status: ["inProgress", "paused", "completed"], createdBy: { userId: USER_ID, value: ["you"] } },
        ACTOR_CONTEXT
      );
    });

    test("is false on any other publish", async () => {
      mocks.getSurveyCount.mockResolvedValue(3);

      const { data } = await (await save(buildSavedSurvey({ status: "inProgress" }))).json();

      expect(data.isSecondPublish).toBe(false);
    });

    test("costs no count when the save is not a publish, or the in-app surveys are not configured", async () => {
      mocks.getSurvey.mockResolvedValue(storedSurvey({ status: "paused" }));
      expect(
        (await (await save(buildSavedSurvey({ status: "inProgress" }))).json()).data.isSecondPublish
      ).toBe(false);

      mocks.constants.IS_FORMBRICKS_SURVEYS_CONFIGURED = false;
      mocks.getSurvey.mockResolvedValue(storedSurvey({ status: "draft" }));
      expect(
        (await (await save(buildSavedSurvey({ status: "inProgress" }))).json()).data.isSecondPublish
      ).toBe(false);

      expect(mocks.getSurveyCount).not.toHaveBeenCalled();
    });
  });
});

describe("PUT /api/internal/surveys/{surveyId}/draft", () => {
  test("saves the draft without full validation, audited, and without revalidating the editor", async () => {
    // A draft may be incomplete: no blocks yet is fine until it is published.
    const response = await saveDraft({ ...buildSavedSurvey(), blocks: [] });

    expect(response.status).toBe(200);
    expect(mocks.updateSurveyDraft).toHaveBeenCalledWith(expect.objectContaining({ id: SURVEY_ID }), {
      customCssPrincipal: USER_ID,
      targetingActor: ACTOR_CONTEXT,
    });
    expect(mocks.updateSurvey).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "survey",
        status: "success",
        targetId: SURVEY_ID,
      })
    );
    // In Next 16 a revalidation re-renders the page the request came from: every 10 s, from the autosave.
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(events()).toEqual([]);
  });

  test("revives the draft's dates, which the write's scheduling compares", async () => {
    const survey = buildSavedSurvey();

    await saveDraft(survey);

    const written = mocks.updateSurveyDraft.mock.calls[0][0] as TSurvey;
    expect(written.closeOn).toEqual(survey.closeOn);
    expect(written.segment?.updatedAt).toEqual(survey.segment?.updatedAt);
  });

  test("refuses a survey that is not a draft", async () => {
    const response = await saveDraft(buildSavedSurvey({ status: "inProgress" }));

    expect(response.status).toBe(400);
    expect(mocks.updateSurveyDraft).not.toHaveBeenCalled();
  });

  test("sends the edit events, but not the publish events", async () => {
    mocks.getSurvey.mockResolvedValue(storedSurvey({ followUps: [] }));

    await saveDraft(buildSavedSurvey());

    expect(events()).toEqual(["follow_up_added"]);
  });
});

describe.each(ROUTES)("%s refusals", (_name, route, url) => {
  const sendSurvey = (body: unknown, options?: Parameters<typeof send>[3]) => send(route, url, body, options);
  const survey = () => buildSavedSurvey({ status: url.endsWith("/draft") ? "draft" : "inProgress" });
  const write = url.endsWith("/draft") ? mocks.updateSurveyDraft : mocks.updateSurvey;

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await sendSurvey(survey())).status).toBe(401);
    expect(write).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request", async () => {
    const response = await sendSurvey(survey(), { headers: { "sec-fetch-site": "cross-site" } });

    expect(response.status).toBe(403);
    expect(write).not.toHaveBeenCalled();
  });

  test("answers a survey the user can't edit and one that does not exist with the same 403", async () => {
    mocks.can.mockResolvedValue(false);
    const denied = await sendSurvey(survey());
    mocks.getOrganizationIdFromSurveyId.mockRejectedValue(new ResourceNotFoundError("Survey", SURVEY_ID));
    mocks.can.mockResolvedValue(true);
    const missing = await sendSurvey(survey());

    expect(denied.status).toBe(403);
    expect(missing.status).toBe(403);
    const { requestId: _a, ...deniedBody } = await problem(denied);
    const { requestId: _b, ...missingBody } = await problem(missing);
    expect(deniedBody).toEqual(missingBody);
    expect(write).not.toHaveBeenCalled();
  });

  test("refuses a body that names another survey than the path, before anything is checked", async () => {
    const response = await sendSurvey({ ...survey(), id: "clother111111111111111111" });

    expect(response.status).toBe(400);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  test("answers a spent workspace budget with the limiter's 429", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 30);
      }
    });

    const response = await sendSurvey(survey());

    expect(response.status).toBe(429);
    expect((await problem(response)).detail).toBe(
      "Maximum number of requests reached. Please try again later."
    );
    expect(write).not.toHaveBeenCalled();
  });

  test("refuses spam protection the organization doesn't have, with the action's message", async () => {
    mocks.checkSpamProtectionPermission.mockRejectedValue(
      new OperationNotAllowedError("Spam protection is not enabled for this organization")
    );

    const response = await sendSurvey({ ...survey(), recaptcha: { enabled: true, threshold: 0.5 } });

    expect(mocks.checkSpamProtectionPermission).toHaveBeenCalledWith(ORG_ID);
    expect(response.status).toBe(403);
    expect((await problem(response)).detail).toBe("Spam protection is not enabled for this organization");
    expect(write).not.toHaveBeenCalled();
  });

  test("checks spam protection only for a survey that turns it on", async () => {
    await sendSurvey(survey());

    expect(mocks.checkSpamProtectionPermission).not.toHaveBeenCalled();
  });

  test("refuses a new follow-up without the follow-ups entitlement, and keeps an existing one", async () => {
    mocks.getSurveyFollowUpsPermission.mockResolvedValue(false);

    mocks.getSurvey.mockResolvedValue(storedSurvey({ followUps: [] }));
    const added = await sendSurvey(survey());
    expect(added.status).toBe(403);
    expect((await problem(added)).detail).toBe("Survey follow ups are not enabled for this organization");

    mocks.getSurvey.mockResolvedValue(storedSurvey());
    expect((await sendSurvey(survey())).status).toBe(200);
    expect(write).toHaveBeenCalledTimes(1);
  });

  test("answers an organization without billing with the uniform 403", async () => {
    mocks.getOrganizationBilling.mockRejectedValue(new ResourceNotFoundError("Organization", ORG_ID));

    const response = await sendSurvey(survey());

    expect(response.status).toBe(403);
    expect((await problem(response)).detail).toBe("You are not authorized to access this resource");
  });

  test("refuses new external URLs without the entitlement, with the check's message", async () => {
    mocks.checkExternalUrlsPermission.mockRejectedValue(
      new OperationNotAllowedError("External URLs are not enabled for this organization")
    );

    const response = await sendSurvey(survey());

    expect(mocks.checkExternalUrlsPermission).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ id: SURVEY_ID }),
      expect.objectContaining({ id: SURVEY_ID })
    );
    expect(response.status).toBe(403);
    expect((await problem(response)).detail).toBe("External URLs are not enabled for this organization");
  });

  describe("custom head scripts", () => {
    const script = "<script>analytics()</script>";
    // A Read & write member: `survey.write` passes, `workspace.manage` does not.
    const actAsReadWriteMember = () =>
      mocks.can.mockImplementation(async (_actor: unknown, action: string) => action !== "workspace.manage");

    test("refuses a Read & write member who sets survey head scripts", async () => {
      actAsReadWriteMember();

      const response = await sendSurvey({ ...survey(), customHeadScripts: script });

      expect(response.status).toBe(403);
      expect(write).not.toHaveBeenCalled();
    });

    test("refuses a Read & write member who switches the scripts to replace the workspace's", async () => {
      actAsReadWriteMember();

      expect((await sendSurvey({ ...survey(), customHeadScriptsMode: "replace" })).status).toBe(403);
      expect(write).not.toHaveBeenCalled();
    });

    test("lets a Read & write member save a survey whose scripts a manager already set", async () => {
      mocks.getSurvey.mockResolvedValue(
        storedSurvey({ customHeadScripts: script, customHeadScriptsMode: "add" })
      );
      actAsReadWriteMember();

      const response = await sendSurvey({
        ...survey(),
        customHeadScripts: script,
        customHeadScriptsMode: "add",
        name: "Renamed",
      });

      expect(response.status).toBe(200);
      expect(write).toHaveBeenCalled();
    });

    test("lets a member with Manage access set survey head scripts", async () => {
      const response = await sendSurvey({ ...survey(), customHeadScripts: script });

      expect(response.status).toBe(200);
      expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "workspace.manage", {
        type: "workspace",
        id: WORKSPACE_ID,
      });
      expect(write).toHaveBeenCalledWith(
        expect.objectContaining({ customHeadScripts: script }),
        expect.anything()
      );
    });
  });

  describe("the write's refusals keep the message the editor's toast showed", () => {
    test.each([
      [
        "a published survey's locked field (422)",
        new InvalidInputError("published_survey_locked: the question type of q1 cannot change"),
        422,
      ],
      [
        "a schedule whose dates don't fit (400)",
        new ValidationError("Close date must be after publish date"),
        400,
      ],
      ["a taken unique value (409)", new UniqueConstraintError("Survey slug already exists"), 409],
      [
        "a change creatives block (409)",
        new SurveyLinkedCreativesError(
          "status_change" as never,
          [{ id: "clcreative", name: "Banner" }] as never
        ),
        409,
      ],
      [
        "an operation the service refuses (403)",
        new OperationNotAllowedError("Only draft surveys can be updated without validation"),
        403,
      ],
      ["a spent custom CSS budget (429)", new TooManyRequestsError("Custom CSS budget spent", 60), 429],
    ])("%s", async (_case, error, status) => {
      write.mockRejectedValue(error);

      const response = await sendSurvey(survey());

      expect(response.status).toBe(status);
      expect((await problem(response)).detail).toBe(error.message);
      expect(mocks.queueAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
    });

    test("a fault is a 500 that says nothing of it", async () => {
      write.mockRejectedValue(new DatabaseError("connection reset by peer"));

      const response = await sendSurvey(survey());

      expect(response.status).toBe(500);
      expect(JSON.stringify(await problem(response))).not.toContain("connection reset");
    });
  });

  describe("caps", () => {
    /** The survey as JSON, padded with an unknown key to exactly `bytes`, in strings within their cap. */
    const bodyOfSize = (bytes: number): string => {
      // Bytes, not characters: the fixture's name carries multi-byte characters.
      const base = Buffer.byteLength(JSON.stringify({ ...survey(), padding: [] }));
      const extra = bytes - base;
      const chunkCount = Math.ceil((extra + 1) / (SURVEY_SAVE_MAX_STRING_LENGTH + 3));
      const content = extra - (3 * chunkCount - 1);
      const chunks = Array.from({ length: chunkCount }, (_, index) =>
        "x".repeat(Math.floor(content / chunkCount) + (index === 0 ? content % chunkCount : 0))
      );
      const body = JSON.stringify({ ...survey(), padding: chunks });
      expect(Buffer.byteLength(body)).toBe(bytes);
      return body;
    };

    test(`takes a body of ${SURVEY_SAVE_MAX_BODY_BYTES} bytes and answers a larger one with a 413`, async () => {
      expect((await sendSurvey(bodyOfSize(SURVEY_SAVE_MAX_BODY_BYTES))).status).toBe(200);

      const overLimit = await sendSurvey(bodyOfSize(SURVEY_SAVE_MAX_BODY_BYTES + 1));

      expect(overLimit.status).toBe(413);
      expect(write).toHaveBeenCalledTimes(1);
    });

    test(`takes a question with ${SURVEY_SAVE_MAX_ARRAY_ITEMS} choices, past the request-wide 1,000, and not one more`, async () => {
      const withChoices = (count: number) => {
        const base = survey();
        return {
          ...base,
          blocks: [
            {
              ...base.blocks[0],
              elements: [
                {
                  id: "pick",
                  type: "multipleChoiceSingle",
                  headline: { default: "Pick one" },
                  required: true,
                  shuffleOption: "none",
                  choices: Array.from({ length: count }, (_, index) => ({
                    id: `c${index}`,
                    label: { default: `Choice ${index}` },
                  })),
                },
              ],
            },
          ],
        };
      };

      expect((await sendSurvey(withChoices(SURVEY_SAVE_MAX_ARRAY_ITEMS))).status).toBe(200);

      const tooMany = await sendSurvey(withChoices(SURVEY_SAVE_MAX_ARRAY_ITEMS + 1));
      expect(tooMany.status).toBe(400);
      expect((await problem(tooMany)).invalid_params).toEqual([
        {
          name: "blocks.0.elements.0.choices",
          reason: `Too big: expected array to have <=${SURVEY_SAVE_MAX_ARRAY_ITEMS} items`,
        },
      ]);
      expect(write).toHaveBeenCalledTimes(1);
    });

    test(`takes a string of ${SURVEY_SAVE_MAX_STRING_LENGTH} characters and names one longer`, async () => {
      expect(
        (await sendSurvey({ ...survey(), name: "n".repeat(SURVEY_SAVE_MAX_STRING_LENGTH) })).status
      ).toBe(200);

      const tooLong = await sendSurvey({ ...survey(), name: "n".repeat(SURVEY_SAVE_MAX_STRING_LENGTH + 1) });
      expect(tooLong.status).toBe(400);
      expect((await problem(tooLong)).invalid_params).toEqual([
        {
          name: "name",
          reason: `Too big: expected string to have <=${SURVEY_SAVE_MAX_STRING_LENGTH} characters`,
        },
      ]);
    });

    test(`takes an object of ${SURVEY_SAVE_MAX_OBJECT_KEYS} keys and names one wider`, async () => {
      const withMetadataKeys = (count: number) => ({
        ...survey(),
        metadata: {
          title: Object.fromEntries([
            ["default", "Title"],
            ...Array.from({ length: count - 1 }, (_, index) => [`l${index}`, "Title"]),
          ]),
        },
      });

      expect((await sendSurvey(withMetadataKeys(SURVEY_SAVE_MAX_OBJECT_KEYS))).status).toBe(200);

      const tooWide = await sendSurvey(withMetadataKeys(SURVEY_SAVE_MAX_OBJECT_KEYS + 1));
      expect(tooWide.status).toBe(400);
      expect((await problem(tooWide)).invalid_params).toEqual([
        {
          name: "metadata.title",
          reason: `Too big: expected object to have <=${SURVEY_SAVE_MAX_OBJECT_KEYS} entries`,
        },
      ]);
    });

    test("refuses a number JSON reads as infinite", async () => {
      const body = JSON.stringify(survey()).replace(/"delay":\d+/, '"delay":1e999');
      expect(body).toContain('"delay":1e999');

      const response = await sendSurvey(body);

      expect(response.status).toBe(400);
      expect(write).not.toHaveBeenCalled();
    });

    test(`holds an integer column to ${SURVEY_SAVE_MAX_INT_COLUMN}`, async () => {
      expect((await sendSurvey({ ...survey(), recontactDays: SURVEY_SAVE_MAX_INT_COLUMN })).status).toBe(200);

      const tooBig = await sendSurvey({ ...survey(), recontactDays: SURVEY_SAVE_MAX_INT_COLUMN + 1 });
      expect(tooBig.status).toBe(400);
      expect((await problem(tooBig)).invalid_params).toEqual([
        { name: "recontactDays", reason: `Too big: expected number to be <=${SURVEY_SAVE_MAX_INT_COLUMN}` },
      ]);
    });
  });
});
