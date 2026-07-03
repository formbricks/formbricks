/**
 * ENG-1228 — workflow `send_email` Follow-Ups RENDER-PARITY lock-in (integration).
 *
 * Sibling to `process-workflow-run-job.test.ts`, which mocks the HTML builder (`buildSurveyResponseEmailHtml`)
 * and asserts on the *arguments* handed to a mocked `sendEmail`. That unit test proves the wiring but, by
 * design, fakes the exact thing that must not regress: the branded HTML, recall expansion, sanitization,
 * response-data table, HTML-only shape, and the MAIL_FROM sender default.
 *
 * This test therefore drives the REAL `processWorkflowRunJob` end-to-end with the render/transport stack
 * left INTACT:
 *   - REAL `buildSurveyResponseEmailHtml` → `parseRecallInfo` + `sanitizeHtml` + `getElementResponseMapping`
 *     + `renderFollowUpEmail` (react-email) + real i18n (`getTranslate`).
 *   - REAL `resolveResponseRecipient` (Follow-Ups recipient resolution).
 *   - REAL `sendEmail` from `@/modules/email` — so the deployment `MAIL_FROM` default is applied by the
 *     production code path, not asserted against a stub.
 *
 * The ONLY mocked boundaries are:
 *   - the outermost transport: `nodemailer.createTransport().sendMail` — captured so we can assert on the
 *     fully-built message (from/subject/html) that would go on the wire.
 *   - the durable/data edges the runner reads: `prisma`, `getResponse`, `getSurvey`,
 *     `getOrganizationByWorkspaceId`, and `logger`. These are infra, not render logic.
 *
 * MAIL_FROM comes from the shared vitestSetup `@/lib/constants` mock:
 *   MAIL_FROM = "mock@mail.com", MAIL_FROM_NAME = "Mock Mail"  →  From: `Mock Mail <mock@mail.com>`.
 *
 * No external services: prisma and nodemailer are mocked, so this runs in CI with no DB and no SMTP server.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowRunJobData } from "@formbricks/jobs";
import { processWorkflowRunJob } from "./process-workflow-run-job";

// ---------------------------------------------------------------------------
// Mocks — ONLY the transport boundary and the durable/data edges. The whole
// render pipeline (buildSurveyResponseEmailHtml, renderFollowUpEmail,
// parseRecallInfo, sanitizeHtml, resolveResponseRecipient, getTranslate) is REAL.
// ---------------------------------------------------------------------------
const {
  mockSendMail,
  mockCreateTransport,
  mockLoggerError,
  mockLoggerInfo,
  mockLoggerWarn,
  mockWorkflowRunFindFirst,
  mockWorkflowRunUpdateMany,
  mockWorkflowRunLogCreate,
  mockWorkflowRunLogUpdate,
  mockWorkflowRunLogUpdateMany,
  mockWorkflowRunLogFindFirst,
  mockGetResponse,
  mockGetSurvey,
  mockGetOrganizationByWorkspaceId,
} = vi.hoisted(() => {
  const sendMail = vi.fn();
  return {
    mockSendMail: sendMail,
    mockCreateTransport: vi.fn(() => ({ sendMail })),
    mockLoggerError: vi.fn(),
    mockLoggerInfo: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockWorkflowRunFindFirst: vi.fn(),
    mockWorkflowRunUpdateMany: vi.fn(),
    mockWorkflowRunLogCreate: vi.fn(),
    mockWorkflowRunLogUpdate: vi.fn(),
    mockWorkflowRunLogUpdateMany: vi.fn(),
    mockWorkflowRunLogFindFirst: vi.fn(),
    mockGetResponse: vi.fn(),
    mockGetSurvey: vi.fn(),
    mockGetOrganizationByWorkspaceId: vi.fn(),
  };
});

// Outermost transport: mock nodemailer so the REAL sendEmail() runs and applies MAIL_FROM, but no SMTP
// connection is made. sendMail captures the fully-built message we assert on.
vi.mock("nodemailer", () => ({
  createTransport: mockCreateTransport,
  default: { createTransport: mockCreateTransport },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    workflowRun: {
      findFirst: mockWorkflowRunFindFirst,
      updateMany: mockWorkflowRunUpdateMany,
    },
    workflowRunLog: {
      create: mockWorkflowRunLogCreate,
      update: mockWorkflowRunLogUpdate,
      updateMany: mockWorkflowRunLogUpdateMany,
      findFirst: mockWorkflowRunLogFindFirst,
    },
  },
}));

vi.mock("@/lib/response/service", () => ({ getResponse: mockGetResponse }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: mockGetSurvey }));
vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: mockGetOrganizationByWorkspaceId,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: mockLoggerError,
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
  },
}));

// ---------------------------------------------------------------------------
// Fixtures — a real survey block/element + a completing response with answers,
// so getElementResponseMapping produces a genuine response-data row and recall
// resolves against real response data. `to` is a question id resolved to an email.
// ---------------------------------------------------------------------------
const WORKSPACE_ID = "cm9zr4wsp000508l8y6nh9r2v";
const SURVEY_ID = "cm9zr4mps000008l8btfy1vtz";
const RESPONSE_ID = "cm9zr4rsp000708l8bqccpfrx";
const RUN_ID = "cm9zr4run000908l8q9b9d3pm";
const WORKFLOW_ID = "cm9zr4wfl000008l8q9b9d3pm";

const EMAIL_ELEMENT_ID = "email-question";
const NAME_ELEMENT_ID = "name-question";

const RECIPIENT_EMAIL = "respondent@example.com";
const RESPONDENT_NAME = "Ada Lovelace";
const NAME_QUESTION_HEADLINE = "What is your name?";

// Deliberately BOGUS — proves config.from is NOT used as the sender (Follow-Ups parity: MAIL_FROM applies).
const BOGUS_FROM = "bogus-should-be-ignored@evil.example";

const triggerPayload = {
  type: "response.completed" as const,
  workspaceId: WORKSPACE_ID,
  surveyId: SURVEY_ID,
  responseId: RESPONSE_ID,
  endingCardId: "cm9zr4q7i000108l84gozfggr",
  data: { response: { [EMAIL_ELEMENT_ID]: RECIPIENT_EMAIL, [NAME_ELEMENT_ID]: RESPONDENT_NAME } },
  triggeredAt: "2026-06-09T12:01:00.000Z",
};

// trigger(response.completed, surveyId, endingCardIds=[]) -> send_email
//   to = a question id resolving to an email
//   body = recall body whose elementId resolves against the response (fallback "there" must NOT show)
//   from = BOGUS (must be ignored)
//   attachResponseData: true
const makeDefinition = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  entryNodeId: "trigger",
  trigger: {
    id: "trigger",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId: SURVEY_ID, endingCardIds: [] },
  },
  nodes: [
    {
      id: "send-email",
      type: "action",
      actionType: "send_email",
      label: "Send thank you email",
      config: {
        to: EMAIL_ELEMENT_ID,
        from: BOGUS_FROM,
        replyTo: [],
        subject: "Thanks for your response",
        body: `<p>Hi #recall:${NAME_ELEMENT_ID}/fallback:there#, thanks!</p>`,
        attachResponseData: true,
        includeVariables: false,
        includeHiddenFields: false,
        ...overrides,
      },
    },
  ],
  edges: [{ id: "trigger-send-email", source: "trigger", target: "send-email" }],
});

const makeRun = (definition = makeDefinition(), overrides: Record<string, unknown> = {}) => ({
  id: RUN_ID,
  status: "queued",
  attempt: 0,
  triggerPayload,
  workflowVersion: { definition },
  workflow: { definition },
  ...overrides,
});

// Real survey shape consumed by getElementResponseMapping (blocks -> elements) with localized headlines.
const survey = {
  id: SURVEY_ID,
  workspaceId: WORKSPACE_ID,
  languages: [],
  blocks: [
    {
      id: "block-1",
      elements: [
        {
          id: EMAIL_ELEMENT_ID,
          type: "openText",
          headline: { default: "What is your email?" },
          required: true,
          inputType: "email",
          longAnswer: false,
          charLimit: { enabled: false },
        },
        {
          id: NAME_ELEMENT_ID,
          type: "openText",
          headline: { default: NAME_QUESTION_HEADLINE },
          required: true,
          inputType: "text",
          longAnswer: false,
          charLimit: { enabled: false },
        },
      ],
    },
  ],
  variables: [],
  hiddenFields: { enabled: false, fieldIds: [] },
};

const response = {
  id: RESPONSE_ID,
  surveyId: SURVEY_ID,
  data: { [EMAIL_ELEMENT_ID]: RECIPIENT_EMAIL, [NAME_ELEMENT_ID]: RESPONDENT_NAME },
  variables: {},
  language: "en-US",
  finished: true,
};

const jobData: TWorkflowRunJobData = {
  workflowRunId: RUN_ID,
  workflowId: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
};

const baseContext = {
  attempt: 1,
  jobId: "job_123",
  jobName: "workflow-run.process",
  maxAttempts: 3,
  queueName: "background-jobs",
};
const finalAttemptContext = { ...baseContext, attempt: baseContext.maxAttempts };

/** The message object the REAL sendEmail built and handed to nodemailer's sendMail. */
const capturedMessage = (): {
  from?: string;
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  replyTo?: string;
  messageId?: string;
} => {
  expect(mockSendMail).toHaveBeenCalledTimes(1);
  return mockSendMail.mock.calls[0][0];
};

describe("processWorkflowRunJob — send_email Follow-Ups render parity (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkflowRunFindFirst.mockResolvedValue(makeRun());
    mockWorkflowRunUpdateMany.mockResolvedValue({ count: 1 });
    mockWorkflowRunLogCreate.mockResolvedValue(undefined);
    mockWorkflowRunLogUpdate.mockResolvedValue(undefined);
    mockWorkflowRunLogUpdateMany.mockResolvedValue({ count: 1 });
    mockWorkflowRunLogFindFirst.mockResolvedValue(null);
    mockGetResponse.mockResolvedValue(response);
    mockGetSurvey.mockResolvedValue(survey);
    mockGetOrganizationByWorkspaceId.mockResolvedValue({ id: "org1", whitelabel: { logoUrl: "" } });
    // The real sendEmail awaits sendMail; a resolved value means "sent".
    mockSendMail.mockResolvedValue({ messageId: "smtp-accepted" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("happy path — the actually-built message", () => {
    test("assertion 1: From is the deployment MAIL_FROM, NOT the config `from` (bogus address absent)", async () => {
      await expect(processWorkflowRunJob(jobData, baseContext)).resolves.toBeUndefined();

      const msg = capturedMessage();
      // MAIL_FROM / MAIL_FROM_NAME come from the shared vitestSetup constants mock.
      expect(msg.from).toBe("Mock Mail <mock@mail.com>");
      // The bogus config.from must never appear as sender.
      expect(msg.from).not.toContain("bogus-should-be-ignored");
      expect(msg.from).not.toContain(BOGUS_FROM);
    });

    test("assertion 2: recall is resolved against the response (value present, no literal #recall: remains)", async () => {
      await processWorkflowRunJob(jobData, baseContext);

      const html = capturedMessage().html ?? "";
      expect(html).toContain(RESPONDENT_NAME); // "Ada Lovelace" — the resolved recall value
      expect(html).not.toContain("#recall:"); // no unresolved recall tag survived
      expect(html).not.toMatch(/Hi\s+there,\s+thanks!/); // the fallback "there" must NOT have been used
    });

    test("assertion 3: full branded template from renderFollowUpEmail (not a bare <p>)", async () => {
      await processWorkflowRunJob(jobData, baseContext);

      const html = capturedMessage().html ?? "";
      // Full HTML document (react-email <Html> root) with table layout + Formbricks branded footer.
      expect(html).toMatch(/<!doctype html/i);
      expect(html).toMatch(/<html/i);
      expect(html).toMatch(/<table/i);
      expect(html).toContain("This email was sent via Formbricks."); // branded footer (emails.email_template_text_1)
      // It is emphatically NOT just the raw body paragraph.
      expect(html).not.toBe(`<p>Hi ${RESPONDENT_NAME}, thanks!</p>`);
      expect(html.length).toBeGreaterThan(500);
    });

    test("assertion 4: response-data table is present (question headline + answer rows)", async () => {
      await processWorkflowRunJob(jobData, baseContext);

      const html = capturedMessage().html ?? "";
      expect(html).toContain("Response data"); // section heading (emails.response_data)
      expect(html).toContain(NAME_QUESTION_HEADLINE); // the question headline row
      expect(html).toContain(RESPONDENT_NAME); // the answer value row
    });

    test("assertion 5: HTML-only — an html body and no text/plain part carrying markup", async () => {
      await processWorkflowRunJob(jobData, baseContext);

      const msg = capturedMessage();
      expect(typeof msg.html).toBe("string");
      expect((msg.html ?? "").length).toBeGreaterThan(0);
      // No text/plain alternative at all — parity with survey Follow-Ups (HTML-only send).
      expect(msg.text).toBeUndefined();
    });

    test("recipient is resolved Follow-Ups-style from the response question id; subject preserved", async () => {
      await processWorkflowRunJob(jobData, baseContext);

      const msg = capturedMessage();
      expect(msg.to).toBe(RECIPIENT_EMAIL);
      expect(msg.subject).toBe("Thanks for your response");
      expect(msg.messageId).toMatch(/^<.+@.+>$/);
    });

    test("run completes and the send_email step log is recorded as succeeded", async () => {
      await processWorkflowRunJob(jobData, baseContext);

      // Terminal transition = completed.
      const completion = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
      expect(completion.data.status).toBe("completed");
      expect(completion.data.data.steps[0]).toMatchObject({
        stepId: "send-email",
        stepType: "send_email",
        status: "succeeded",
      });

      // Claim-before-send: the step row is created `running` first, then updated to `succeeded` on the
      // same row (never a second create — the (runId, stepId) unique constraint forbids it).
      expect(mockWorkflowRunLogCreate).toHaveBeenCalledTimes(1);
      expect(mockWorkflowRunLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stepId: "send-email",
            stepType: "send_email",
            status: "running",
          }),
        })
      );
      expect(mockWorkflowRunLogUpdate).toHaveBeenCalledTimes(1);
      expect(mockWorkflowRunLogUpdate.mock.calls[0][0].data.status).toBe("succeeded");
    });
  });

  describe("assertion 6: tenant guard", () => {
    test("a run whose trigger survey belongs to another workspace ends `failed` and sends NOTHING", async () => {
      mockGetSurvey.mockResolvedValue({ ...survey, workspaceId: "cm9zr4wsp000000000foreign" });

      await expect(processWorkflowRunJob(jobData, finalAttemptContext)).resolves.toBeUndefined();

      // Nothing built, nothing sent.
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(mockCreateTransport).not.toHaveBeenCalled();

      // Run failed with the tenant-guard error.
      const failure = mockWorkflowRunUpdateMany.mock.calls.at(-1)?.[0];
      expect(failure.data.status).toBe("failed");
      expect(failure.data.error).toMatch(/does not belong to workspace/);
    });
  });
});
