import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TWorkflowRunContext, TWorkflowSendEmailActionNode } from "@formbricks/workflows";
import type { WorkflowRunEffects } from "../effects";
import type { WorkflowRunEnvironment } from "../run-environment";
import { sendEmailStepExecutor } from "./send-email";

const { buildResponseHtml, buildFixedHtml } = vi.hoisted(() => ({
  buildResponseHtml: vi.fn(async () => "<html>response</html>"),
  buildFixedHtml: vi.fn(async () => "<html>fixed</html>"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/email/lib/survey-response-email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/email/lib/survey-response-email")>();
  return {
    ...actual,
    buildSurveyResponseEmailHtml: buildResponseHtml,
    buildWorkflowEmailHtml: buildFixedHtml,
  };
});

const linkSurveyId = "cm9zr4q7i000108l84gozfggr";

const node = (
  config: Partial<TWorkflowSendEmailActionNode["config"]> = {}
): TWorkflowSendEmailActionNode => ({
  id: "email",
  type: "action",
  actionType: "send_email",
  config: {
    to: { type: "variable", ref: "payload.customer.email" },
    from: "noreply@example.com",
    replyTo: [],
    subject: "How was your call?",
    body: "<p>Thanks for calling. #survey-link#</p>",
    attachResponseData: false,
    surveyLink: {
      surveyId: linkSurveyId,
      embeddedData: [{ key: "call_id", value: "#recall:payload.call.id/fallback:#" }],
    },
    ...config,
  },
});

const webhookContext = (customer: Record<string, unknown>): TWorkflowRunContext => ({
  payload: { customer, call: { id: "K-771" } },
  steps: {},
});

const environment = (overrides: Partial<WorkflowRunEnvironment> = {}): WorkflowRunEnvironment => ({
  runId: "run_1",
  workflowId: "wf_1",
  workspaceId: "ws_1",
  configuredByUserId: "creator-1",
  surveyResponse: null,
  logoUrl: "",
  allowedRecipientEmails: new Set(["team@example.com"]),
  rateLimit: { organizationId: "org_1", actorUserId: "creator-1" },
  publicDomain: "https://surveys.example.com",
  surveyLinkSurveys: new Map([
    [linkSurveyId, { surveyId: linkSurveyId, status: "ok", acceptedEmbeddedDataKeys: ["call_id"] }],
  ]),
  ...overrides,
});

const sendEmail = vi.fn<WorkflowRunEffects["sendEmail"]>();
const effects: WorkflowRunEffects = { sendEmail };

const run = (
  stepNode: TWorkflowSendEmailActionNode,
  context: TWorkflowRunContext,
  env: WorkflowRunEnvironment = environment()
) => sendEmailStepExecutor.execute({ node: stepNode, context, environment: env, effects });

const surveyLink = `https://surveys.example.com/s/${linkSurveyId}?call_id=K-771`;

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue(true);
});

describe("send_email to an address from the payload (ENG-7180)", () => {
  test("a Webhook run emails the payload address a survey link carrying its Embedded Data", async () => {
    const outcome = await run(node(), webhookContext({ email: "lena@example.com" }));

    expect(outcome).toMatchObject({
      status: "succeeded",
      output: { recipient: "lena@example.com", surveyLink },
    });
    expect(buildFixedHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        body: `<p>Thanks for calling. <a href="${surveyLink}">${surveyLink}</a></p>`,
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        emailType: "workflow_email",
        to: "lena@example.com",
        html: "<html>fixed</html>",
        rateLimit: {
          organizationId: "org_1",
          actorUserId: "creator-1",
          externalRecipient: true,
          workflowId: "wf_1",
        },
      })
    );
  });

  test("an empty address fails the step for good, without sending", async () => {
    const outcome = await run(node(), webhookContext({ email: "" }));

    expect(outcome).toMatchObject({ status: "failed", retryable: false });
    expect(outcome.error).toMatch(/payload\.customer\.email/);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("an invalid address fails the step for good, without sending", async () => {
    const outcome = await run(node(), webhookContext({ email: "not-an-address" }));

    expect(outcome).toMatchObject({ status: "failed", retryable: false });
    expect(outcome.error).toMatch(/not a valid email address/);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("a spent cap fails the step for good, naming the recipient in run detail", async () => {
    sendEmail.mockRejectedValue(new TooManyRequestsError("Maximum number of requests reached"));

    const outcome = await run(node(), webhookContext({ email: "lena@example.com" }));

    expect(outcome).toMatchObject({
      status: "failed",
      retryable: false,
      output: { recipient: "lena@example.com" },
    });
    expect(outcome.error).toMatch(/rate limit/i);
  });

  test("a linked survey that is no longer a link survey in the workspace fails the step", async () => {
    const outcome = await run(
      node(),
      webhookContext({ email: "lena@example.com" }),
      environment({
        surveyLinkSurveys: new Map([
          [linkSurveyId, { surveyId: linkSurveyId, status: "not_link", acceptedEmbeddedDataKeys: [] }],
        ]),
      })
    );

    expect(outcome).toMatchObject({ status: "failed", retryable: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("a literal workspace member can be emailed from a run without a response", async () => {
    const outcome = await run(
      node({ to: "team@example.com", surveyLink: undefined, body: "<p>A call ended.</p>" }),
      webhookContext({})
    );

    expect(outcome).toMatchObject({ status: "succeeded", output: { recipient: "team@example.com" } });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ rateLimit: expect.objectContaining({ externalRecipient: false }) })
    );
  });
});

describe("send_email with a survey response", () => {
  const survey = { id: "survey_1" } as TSurvey;
  const response = { id: "response_1", data: {}, variables: {}, language: null } as unknown as TResponse;

  test("includeEmbeddedData adds the response's Embedded Data like the deprecated includeVariables", async () => {
    await run(
      node({
        to: "team@example.com",
        surveyLink: undefined,
        body: "<p>New response</p>",
        attachResponseData: true,
        includeEmbeddedData: true,
      }),
      { steps: {}, response: { data: {} } },
      environment({ surveyResponse: { survey, response } })
    );

    expect(buildResponseHtml).toHaveBeenCalledWith(expect.objectContaining({ includeVariables: true }));
  });
});
