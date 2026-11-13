import { describe, expect, test } from "vitest";
import { ZWorkflowDefinition, ZWorkflowExecutableDefinition } from "../document";
import {
  type TWorkflowSendEmailActionConfig,
  WORKFLOW_SURVEY_LINK_TOKEN,
  ZWorkflowSendEmailActionConfig,
} from "./send-email";

const surveyId = "cm9zr4mps000008l8btfy1vtz";
const linkSurveyId = "cm9zr4q7i000108l84gozfggr";

const baseConfig: TWorkflowSendEmailActionConfig = {
  from: "noreply@example.com",
  to: "jane@example.com",
  replyTo: [],
  subject: "How was your call?",
  body: "<p>Thanks for calling.</p>",
  attachResponseData: false,
};

const definitionWith = (config: Record<string, unknown>) => ({
  schemaVersion: 1,
  trigger: {
    id: "trigger",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId, endingCardIds: [] },
  },
  nodes: [{ id: "email", type: "action", actionType: "send_email", config }],
  edges: [{ id: "trigger-email", source: "trigger", target: "email" }],
  entryNodeId: "trigger",
});

const executableIssues = (config: Record<string, unknown>): string[] => {
  const result = ZWorkflowExecutableDefinition.safeParse(definitionWith(config));
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

const variableRecipient = { type: "variable", ref: "response.email" };

describe("send_email recipient", () => {
  test("accepts a Variable recipient", () => {
    const parsed = ZWorkflowSendEmailActionConfig.parse({ ...baseConfig, to: variableRecipient });
    expect(parsed.to).toEqual(variableRecipient);
  });

  test("refuses a Variable recipient whose path is not a Variable path", () => {
    expect(
      ZWorkflowSendEmailActionConfig.safeParse({ ...baseConfig, to: { type: "variable", ref: "q1" } }).success
    ).toBe(false);
  });
});

describe("Embedded Data option names", () => {
  test("accepts includeEmbeddedData and the deprecated includeVariables, stored as written", () => {
    expect(ZWorkflowSendEmailActionConfig.parse({ ...baseConfig, includeEmbeddedData: true })).toMatchObject({
      includeEmbeddedData: true,
    });
    const legacy = ZWorkflowSendEmailActionConfig.parse({ ...baseConfig, includeVariables: true });
    expect(legacy).toMatchObject({ includeVariables: true });
    expect(legacy).not.toHaveProperty("includeEmbeddedData");
  });

  test("refuses both names together", () => {
    const result = ZWorkflowSendEmailActionConfig.safeParse({
      ...baseConfig,
      includeEmbeddedData: true,
      includeVariables: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/includeEmbeddedData.*includeVariables|not both/i);
  });
});

describe("survey link", () => {
  test("refuses an Embedded Data key twice", () => {
    expect(
      ZWorkflowSendEmailActionConfig.safeParse({
        ...baseConfig,
        surveyLink: {
          surveyId: linkSurveyId,
          embeddedData: [
            { key: "agent_id", value: "a" },
            { key: "Agent_Id", value: "b" },
          ],
        },
      }).success
    ).toBe(false);
  });

  test("a draft may hold the link token without a survey, but Enable refuses it", () => {
    const config = { ...baseConfig, body: `<p>${WORKFLOW_SURVEY_LINK_TOKEN}</p>` };
    expect(ZWorkflowDefinition.safeParse(definitionWith(config)).success).toBe(true);
    expect(executableIssues(config).join(" ")).toMatch(/survey link/i);
  });

  test("Enable refuses a survey link the body never places", () => {
    expect(
      executableIssues({
        ...baseConfig,
        surveyLink: { surveyId: linkSurveyId, embeddedData: [] },
      }).join(" ")
    ).toMatch(new RegExp(WORKFLOW_SURVEY_LINK_TOKEN));
  });

  test("Enable checks the Variables in Embedded Data values", () => {
    expect(
      executableIssues({
        ...baseConfig,
        body: `<p>${WORKFLOW_SURVEY_LINK_TOKEN}</p>`,
        surveyLink: {
          surveyId: linkSurveyId,
          embeddedData: [{ key: "agent_id", value: "#recall:steps.nope.id/fallback:#" }],
        },
      }).join(" ")
    ).toMatch(/never runs before this step/);
  });

  test("a placed survey link with valid Embedded Data is executable", () => {
    expect(
      executableIssues({
        ...baseConfig,
        body: `<p>Tell us: ${WORKFLOW_SURVEY_LINK_TOKEN}</p>`,
        surveyLink: {
          surveyId: linkSurveyId,
          embeddedData: [{ key: "q1_answer", value: "#recall:response.q1/fallback:none#" }],
        },
      })
    ).toEqual([]);
  });
});

describe("fixed body for a Variable recipient", () => {
  test("Enable refuses a Variable in the body", () => {
    expect(
      executableIssues({
        ...baseConfig,
        to: variableRecipient,
        body: "<p>Hi #recall:response.name/fallback:there#</p>",
      }).join(" ")
    ).toMatch(/fixed/i);
  });

  test("Enable refuses a survey answer recalled in the body", () => {
    expect(
      executableIssues({
        ...baseConfig,
        to: variableRecipient,
        body: "<p>Hi #recall:q1/fallback:there#</p>",
      }).join(" ")
    ).toMatch(/fixed/i);
  });

  test("Enable refuses a Variable in the subject", () => {
    expect(
      executableIssues({
        ...baseConfig,
        to: variableRecipient,
        subject: "Hi #recall:response.name/fallback:there#",
      }).join(" ")
    ).toMatch(/fixed/i);
  });

  test("Enable refuses response data attached to the email", () => {
    expect(
      executableIssues({ ...baseConfig, to: variableRecipient, attachResponseData: true }).join(" ")
    ).toMatch(/attachResponseData/);
  });

  test("a fixed body with a survey link carrying Variables is executable", () => {
    expect(
      executableIssues({
        ...baseConfig,
        to: variableRecipient,
        body: `<p>Thanks for calling. ${WORKFLOW_SURVEY_LINK_TOKEN}</p>`,
        surveyLink: {
          surveyId: linkSurveyId,
          embeddedData: [{ key: "call_id", value: "#recall:response.q1/fallback:#" }],
        },
      })
    ).toEqual([]);
  });

  test("a literal recipient may still use Variables in the body", () => {
    expect(
      executableIssues({ ...baseConfig, body: "<p>Hi #recall:response.name/fallback:there#</p>" })
    ).toEqual([]);
  });

  test("a Webhook workflow may email the payload address with a fixed body", () => {
    const definition = {
      ...definitionWith({
        ...baseConfig,
        to: { type: "variable", ref: "payload.customer.email" },
        body: `<p>Thanks for calling. ${WORKFLOW_SURVEY_LINK_TOKEN}</p>`,
        surveyLink: {
          surveyId: linkSurveyId,
          embeddedData: [{ key: "call_id", value: "#recall:payload.call.id/fallback:#" }],
        },
      }),
      trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {} },
    };
    expect(ZWorkflowExecutableDefinition.safeParse(definition).error?.issues).toBeUndefined();
  });

  test("Enable checks the recipient Variable against the trigger's sources", () => {
    expect(
      executableIssues({ ...baseConfig, to: { type: "variable", ref: "payload.customer.email" } }).join(" ")
    ).toMatch(/does not provide/);
  });
});
