import { describe, expect, test } from "vitest";
import { ZWebhookDeliveryJobData } from "./types";

const cuid = (c: string) => c.repeat(24);

const queuedBeforeDeploy = {
  webhookId: cuid("a"),
  workspaceId: cuid("b"),
  surveyId: cuid("c"),
  event: "responseFinished",
  webhookMessageId: "f".repeat(64),
  response: {
    contact: null,
    contactAttributes: null,
    createdAt: "2026-04-08T10:00:00.000Z",
    data: { answer: "x" },
    displayId: null,
    endingId: null,
    finished: true,
    id: cuid("d"),
    language: null,
    meta: {},
    singleUseId: null,
    surveyId: cuid("c"),
    tags: [],
    updatedAt: "2026-04-08T10:00:00.000Z",
    variables: {},
  },
  survey: {
    name: "S",
    type: "link",
    status: "inProgress",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
  },
};

describe("ZWebhookDeliveryJobData survey.questionCodes", () => {
  test("a job queued before question codes existed still parses", () => {
    const parsed = ZWebhookDeliveryJobData.safeParse(queuedBeforeDeploy);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.survey.questionCodes).toBeUndefined();
  });

  test("carries the elementId to code map", () => {
    const parsed = ZWebhookDeliveryJobData.safeParse({
      ...queuedBeforeDeploy,
      survey: { ...queuedBeforeDeploy.survey, questionCodes: { el1: "age", el2: "constructor" } },
    });

    expect(parsed.data?.survey.questionCodes).toEqual({ el1: "age", el2: "constructor" });
  });

  test("rejects a non-string code", () => {
    const parsed = ZWebhookDeliveryJobData.safeParse({
      ...queuedBeforeDeploy,
      survey: { ...queuedBeforeDeploy.survey, questionCodes: { el1: 1 } },
    });

    expect(parsed.success).toBe(false);
  });
});
