import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  type TWorkflowDefinition,
  type TWorkflowTriggerNode,
  detectWebhookVariables,
} from "@formbricks/workflows";
import {
  type TWorkflowStepVariableProviders,
  type TWorkflowVariableGroup,
  WORKFLOW_STEP_VARIABLE_PROVIDERS,
  buildWorkflowVariableGroups,
  filterWorkflowVariableGroups,
  getSendEmailBodyRecall,
  getStepOutputOptionsFromSample,
  getWorkflowVariableRecallItems,
  withWorkflowVariableItems,
} from "./variable-picker";

const SAMPLE_PAYLOAD = {
  event: "call.ended",
  customer: { id: "C-90211", tier: "gold" },
  handle_time_sec: 412,
  resolved: false,
  agent: null,
  tags: ["billing", "vip"],
};

const webhookTrigger = {
  id: "trigger",
  type: "trigger",
  triggerType: "webhook",
  config: {},
} as const;

const emailNode = (id: string, label?: string) => ({
  id,
  type: "action" as const,
  actionType: "send_email" as const,
  label,
  config: {
    to: "",
    from: "noreply@example.com",
    replyTo: [],
    subject: "",
    body: "",
    attachResponseData: false,
  },
});

const webhookDefinition = (): TWorkflowDefinition => ({
  schemaVersion: 1,
  trigger: webhookTrigger,
  nodes: [emailNode("email")],
  edges: [{ id: "e1", source: "trigger", target: "email" }],
  entryNodeId: "trigger",
});

describe("buildWorkflowVariableGroups", () => {
  test("a Webhook workflow offers the Sample payload's scalars under Payload, with type hints", () => {
    const groups = buildWorkflowVariableGroups({
      definition: webhookDefinition(),
      nodeId: "email",
      sampleVariables: detectWebhookVariables(SAMPLE_PAYLOAD),
      survey: null,
    });

    expect(groups).toEqual([
      {
        kind: "payload",
        hasSample: true,
        truncated: false,
        options: [
          { path: "payload.event", label: "event", typeHint: "text", isPickable: true },
          { path: "payload.customer.id", label: "customer.id", typeHint: "text", isPickable: true },
          { path: "payload.customer.tier", label: "customer.tier", typeHint: "text", isPickable: true },
          { path: "payload.handle_time_sec", label: "handle_time_sec", typeHint: "number", isPickable: true },
          { path: "payload.resolved", label: "resolved", typeHint: "boolean", isPickable: true },
          { path: "payload.agent", label: "agent", typeHint: "empty", isPickable: true },
          { path: "payload.tags", label: "tags", typeHint: "list", isPickable: false },
        ],
      },
    ]);
  });

  // An If/else whose Then branch emails and Else branch runs another email; `late` comes after `then`.
  const branchedDefinition = (): TWorkflowDefinition => ({
    schemaVersion: 1,
    trigger: webhookTrigger,
    nodes: [
      emailNode("first", "Notify team"),
      {
        id: "decide",
        type: "if_else",
        config: {
          condition: {
            id: "group",
            connector: "and",
            conditions: [
              {
                id: "c1",
                left: { path: "payload.resolved" },
                operator: "isSet",
              },
            ],
          },
        },
      },
      emailNode("then"),
      emailNode("else"),
      emailNode("late"),
    ],
    edges: [
      { id: "e1", source: "trigger", target: "first" },
      { id: "e2", source: "first", target: "decide" },
      { id: "e3", source: "decide", target: "then", sourceHandle: "then" },
      { id: "e4", source: "decide", target: "else", sourceHandle: "else" },
      { id: "e5", source: "then", target: "late" },
    ],
    entryNodeId: "trigger",
  });

  // Stands in for an action whose output later steps can read (ENG-7179 HTTP request).
  const providersWithEmailOutput: TWorkflowStepVariableProviders = {
    ...WORKFLOW_STEP_VARIABLE_PROVIDERS,
    send_email: {
      ...WORKFLOW_STEP_VARIABLE_PROVIDERS.send_email,
      getVariables: (node) => [
        { path: `steps.${node.id}.messageId`, label: "messageId", typeHint: "text", isPickable: true },
      ],
    },
  };

  test("lists one Steps group per earlier step on the way here, nearest the trigger first", () => {
    const groups = buildWorkflowVariableGroups({
      definition: branchedDefinition(),
      nodeId: "late",
      sampleVariables: null,
      survey: null,
      stepProviders: providersWithEmailOutput,
    });

    expect(groups.filter((group) => group.kind === "step")).toEqual([
      {
        kind: "step",
        stepId: "first",
        stepType: "send_email",
        stepLabel: "Notify team",
        options: [{ path: "steps.first.messageId", label: "messageId", typeHint: "text", isPickable: true }],
      },
      {
        kind: "step",
        stepId: "then",
        stepType: "send_email",
        stepLabel: null,
        options: [{ path: "steps.then.messageId", label: "messageId", typeHint: "text", isPickable: true }],
      },
    ]);
  });

  test("leaves out the step itself, the other branch and steps without Variables", () => {
    const groups = buildWorkflowVariableGroups({
      definition: branchedDefinition(),
      nodeId: "else",
      sampleVariables: null,
      survey: null,
      stepProviders: providersWithEmailOutput,
    });

    // `decide` (If/else) has no output Variables; `then` is on the other branch.
    expect(groups.flatMap((group) => (group.kind === "step" ? [group.stepId] : []))).toEqual(["first"]);
  });

  test("today's step types (Send email, If/else) offer no Variables to later steps", () => {
    const groups = buildWorkflowVariableGroups({
      definition: branchedDefinition(),
      nodeId: "late",
      sampleVariables: null,
      survey: null,
    });

    expect(groups.some((group) => group.kind === "step")).toBe(false);
  });

  test("a payload without a sample yet still shows the Payload group, empty, so the picker can ask for one", () => {
    const groups = buildWorkflowVariableGroups({
      definition: webhookDefinition(),
      nodeId: "email",
      sampleVariables: null,
      survey: null,
    });

    expect(groups).toEqual([{ kind: "payload", hasSample: false, truncated: false, options: [] }]);
  });
});

describe("an HTTP request's Variables", () => {
  const httpNode = (responseMode: "wait" | "dont_wait") => ({
    id: "lookup",
    type: "action" as const,
    actionType: "http_request" as const,
    label: "Get customer tier",
    config: {
      method: "GET" as const,
      url: "https://crm.example.com/customers",
      queryParameters: [],
      headers: [],
      responseMode,
      continueOnError: false,
    },
  });

  const definitionWith = (responseMode: "wait" | "dont_wait"): TWorkflowDefinition => ({
    schemaVersion: 1,
    trigger: webhookTrigger,
    nodes: [httpNode(responseMode), emailNode("email")],
    edges: [
      { id: "e1", source: "trigger", target: "lookup" },
      { id: "e2", source: "lookup", target: "email" },
    ],
    entryNodeId: "trigger",
  });

  const testResponse = { status: 200, contentType: "application/json", body: { tier: "gold" } };

  test("in Wait and use it mode, offer the status and the fields of its last Test request response", () => {
    const groups = buildWorkflowVariableGroups({
      definition: definitionWith("wait"),
      nodeId: "email",
      sampleVariables: null,
      survey: null,
      stepContext: { stepSamples: { lookup: testResponse } },
    });

    expect(groups.find((group) => group.kind === "step")).toEqual({
      kind: "step",
      stepId: "lookup",
      stepType: "http_request",
      stepLabel: "Get customer tier",
      options: [
        { path: "steps.lookup.status", label: "status", typeHint: "number", isPickable: true },
        { path: "steps.lookup.body.tier", label: "body.tier", typeHint: "text", isPickable: true },
      ],
    });
  });

  test("before any Test request, offer the status, the one Variable known without a response", () => {
    const groups = buildWorkflowVariableGroups({
      definition: definitionWith("wait"),
      nodeId: "email",
      sampleVariables: null,
      survey: null,
    });

    expect(groups.find((group) => group.kind === "step")?.options).toEqual([
      { path: "steps.lookup.status", label: "status", typeHint: "number", isPickable: true },
    ]);
  });

  test("in Don't wait mode, offer nothing: the run moves on before the answer", () => {
    const groups = buildWorkflowVariableGroups({
      definition: definitionWith("dont_wait"),
      nodeId: "email",
      sampleVariables: null,
      survey: null,
      stepContext: { stepSamples: { lookup: testResponse } },
    });

    expect(groups.some((group) => group.kind === "step")).toBe(false);
  });
});

describe("getStepOutputOptionsFromSample", () => {
  test("names a step's sample output as steps.<id>.… Variables, scalars pickable and lists not", () => {
    expect(
      getStepOutputOptionsFromSample("lookup", { status: 200, body: { tier: "gold", ids: [1, 2] } })
    ).toEqual([
      { path: "steps.lookup.status", label: "status", typeHint: "number", isPickable: true },
      { path: "steps.lookup.body.tier", label: "body.tier", typeHint: "text", isPickable: true },
      { path: "steps.lookup.body.ids", label: "body.ids", typeHint: "list", isPickable: false },
    ]);
  });
});

describe("filterWorkflowVariableGroups", () => {
  const groups: TWorkflowVariableGroup[] = [
    {
      kind: "payload",
      hasSample: true,
      truncated: false,
      options: [
        { path: "payload.customer.tier", label: "customer.tier", typeHint: "text", isPickable: true },
        { path: "payload.tags", label: "tags", typeHint: "list", isPickable: false },
        { path: "payload.channel", label: "channel", typeHint: "text", isPickable: true },
      ],
    },
    {
      kind: "step",
      stepId: "lookup",
      stepType: "send_email",
      stepLabel: "Get customer tier",
      options: [{ path: "steps.lookup.tier", label: "tier", typeHint: "text", isPickable: true }],
    },
  ];

  test("numbers the pickable rows across groups, the order arrow keys walk", () => {
    const result = filterWorkflowVariableGroups(groups, "");

    expect(result.pickableCount).toBe(3);
    expect(result.groups.map((group) => group.options.map((option) => option.index))).toEqual([
      [0, null, 1],
      [2],
    ]);
  });

  test("matches the search in labels, case-insensitively, and drops groups left empty", () => {
    const result = filterWorkflowVariableGroups(groups, "  TIER ");

    expect(
      result.groups.map((group) => group.options.map((option) => `${option.path}#${option.index}`))
    ).toEqual([["payload.customer.tier#0"], ["steps.lookup.tier#1"]]);
  });

  test("matches nothing and keeps no group for a search no Variable fits", () => {
    expect(filterWorkflowVariableGroups(groups, "zzz")).toEqual({ groups: [], pickableCount: 0 });
  });
});

describe("getWorkflowVariableRecallItems", () => {
  const groups: TWorkflowVariableGroup[] = [
    {
      kind: "payload",
      hasSample: true,
      truncated: false,
      options: [
        { path: "payload.customer.tier", label: "customer.tier", typeHint: "text", isPickable: true },
      ],
    },
  ];

  test("labels each complete Variable token in a text, from the picker or from its path", () => {
    const text =
      "<p>Hi #recall:payload.customer.tier/fallback:there# and #recall:payload.gone/fallback:# " +
      "#recall:steps.lookup.body.tier/fallback:#, #recall:question1/fallback:x# #recall:payload.open</p>";

    // `payload.gone` left the sample but still gets a chip; a bare id is a survey answer, not ours;
    // the unclosed token is not a token yet.
    expect(getWorkflowVariableRecallItems(text, groups)).toEqual([
      { id: "payload.customer.tier", label: "customer.tier", type: "variable" },
      { id: "payload.gone", label: "gone", type: "variable" },
      { id: "steps.lookup.body.tier", label: "steps.lookup.body.tier", type: "variable" },
    ]);
  });
});

describe("withWorkflowVariableItems", () => {
  const surveySource = {
    getRecallItems: (text: string) =>
      text.includes("#recall:q1/") ? [{ id: "q1", label: "Your name", type: "element" as const }] : [],
    getRecallItemLabel: (id: string) => (id === "q1" ? "Your name" : undefined),
    renderPicker: () => null,
  };
  const groups: TWorkflowVariableGroup[] = [
    {
      kind: "response",
      options: [{ path: "response.q1", label: "Your name", typeHint: "text", isPickable: true }],
    },
  ];

  test("keeps the survey's chips and picker, and adds chips for Variable tokens it can't name", () => {
    const source = withWorkflowVariableItems(surveySource, groups);
    const text = "<p>#recall:q1/fallback:# #recall:response.q1/fallback:#</p>";

    expect(source.getRecallItems(text)).toEqual([
      { id: "q1", label: "Your name", type: "element" },
      { id: "response.q1", label: "Your name", type: "variable" },
    ]);
    expect(source.getRecallItemLabel("q1")).toBe("Your name");
    expect(source.getRecallItemLabel("response.q1")).toBe("Your name");
    expect(source.renderPicker).toBe(surveySource.renderPicker);
  });
});

describe("getSendEmailBodyRecall", () => {
  const responseTrigger: TWorkflowTriggerNode = {
    id: "trigger",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId: "survey_1", endingCardIds: [] },
  };

  test("a Response completed workflow keeps the survey recall picker it always had", () => {
    expect(getSendEmailBodyRecall(responseTrigger, "person@example.com")).toBe("survey");
  });

  test("a Webhook workflow picks Variables", () => {
    expect(getSendEmailBodyRecall(webhookTrigger, "person@example.com")).toBe("variables");
  });

  test("offers no picker when a Variable chooses the recipient: the email must be fixed", () => {
    const variableRecipient = { type: "variable", ref: "payload.customer.email" } as const;

    expect(getSendEmailBodyRecall(webhookTrigger, variableRecipient)).toBe("none");
    expect(getSendEmailBodyRecall(responseTrigger, variableRecipient)).toBe("none");
  });

  test("offers no picker before the workflow has a trigger", () => {
    expect(getSendEmailBodyRecall(null, "")).toBe("none");
  });
});

describe("buildWorkflowVariableGroups for a Response completed workflow", () => {
  const embeddedField = (storageKey: string, name: string, source: "computed" | "ingested") => ({
    field: { name, source, dataType: "string" as const, defaultValue: null, locked: false, key: null },
    link: { storageKey },
  });

  const survey = {
    id: "survey_1",
    blocks: [
      {
        id: "b1",
        elements: [
          {
            id: "name",
            type: "openText",
            inputType: "text",
            headline: { default: "<p>What is your name?</p>" },
          },
          { id: "score", type: "rating", headline: { default: "How likely?" } },
          { id: "tools", type: "multipleChoiceMulti", headline: { default: "Which tools?" } },
          { id: "cta", type: "cta", headline: { default: "Book a call" } },
        ],
      },
    ],
    embeddedFields: [
      embeddedField("plan", "Plan", "ingested"),
      embeddedField("score_total", "Total", "computed"),
    ],
  } as unknown as TSurvey;

  const responseDefinition = (): TWorkflowDefinition => ({
    schemaVersion: 1,
    trigger: {
      id: "trigger",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId: "survey_1", endingCardIds: [] },
    },
    nodes: [emailNode("email")],
    edges: [{ id: "e1", source: "trigger", target: "email" }],
    entryNodeId: "trigger",
  });

  test("offers the survey's questions and hidden fields as response.<id> Variables, and no Payload", () => {
    const groups = buildWorkflowVariableGroups({
      definition: responseDefinition(),
      nodeId: "email",
      sampleVariables: null,
      survey,
    });

    // The CTA records no answer recall can show, and a computed field is not in the response data.
    expect(groups).toEqual([
      {
        kind: "response",
        options: [
          {
            path: "response.name",
            label: "What is your name?",
            typeHint: "text",
            isPickable: true,
            iconKey: "openText",
          },
          {
            path: "response.score",
            label: "How likely?",
            typeHint: "number",
            isPickable: true,
            iconKey: "rating",
          },
          {
            path: "response.tools",
            label: "Which tools?",
            typeHint: "list",
            isPickable: true,
            iconKey: "multipleChoiceMulti",
          },
          {
            path: "response.plan",
            label: "Plan",
            typeHint: "text",
            isPickable: true,
            iconKey: "hiddenField",
          },
        ],
      },
    ]);
  });

  test("has no Response group until the bound survey is loaded", () => {
    const groups = buildWorkflowVariableGroups({
      definition: responseDefinition(),
      nodeId: "email",
      sampleVariables: null,
      survey: null,
    });

    expect(groups).toEqual([]);
  });
});
