import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { POST } from "./route";

/**
 * ENG-6932 (T17, P12): a screen-out before the first question. The survey's rules run as it loads;
 * when they send the respondent to an ending, the survey creates the response at once, through the
 * create endpoint every first submit uses. It is finished, carries the ending, the URL parameters /
 * hidden fields that caused it (the response queue merges them into `data`) and the values the rules
 * set, and, with spam protection on, a reCAPTCHA token the endpoint checks.
 *
 * The request body below is what the survey's response queue sends for that create. Only the
 * pipeline (webhooks, integrations) and Google's reCAPTCHA call are stubbed; the route, the ingest
 * contract and the database are real.
 */
const mocks = vi.hoisted(() => ({
  verifyRecaptchaToken: vi.fn(async () => true),
  sendToPipeline: vi.fn(async () => undefined),
}));

vi.mock("@/app/api/v2/client/[workspaceId]/responses/lib/recaptcha", () => ({
  verifyRecaptchaToken: mocks.verifyRecaptchaToken,
}));

vi.mock("@/app/lib/pipelines", () => ({
  sendToPipeline: mocks.sendToPipeline,
}));

vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsSpamProtectionEnabled: vi.fn(async () => true),
}));

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const SCREENED_OUT_ENDING = "screenoutending000000001";
const PANEL_FIELD = "panel_id";
const SEGMENT_VARIABLE = "segmentvariable000000001";

const seed = async ({ recaptcha }: { recaptcha: boolean }) => {
  const organization = await prisma.organization.create({
    data: {
      name: "ACME Inc.",
      // The reCAPTCHA gate reads the organization's billing row.
      billing: { create: { limits: { projects: null, monthly: { responses: null, miu: null } } } },
    },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Retail Banking", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: {
      name: "Panel screener",
      type: "link",
      status: "inProgress",
      workspaceId: workspace.id,
      recaptcha: { enabled: recaptcha, threshold: 0.5 },
      blocks: [
        {
          id: "screenerblock00000000001",
          name: "Block 1",
          elements: [
            {
              id: "experience",
              type: "openText",
              headline: { default: "How was your last branch visit?" },
              required: true,
              inputType: "text",
              charLimit: { enabled: false },
            },
          ],
        },
      ],
      endings: [
        { id: "thanksending000000000001", type: "endScreen", headline: { default: "Thanks!" } },
        { id: SCREENED_OUT_ENDING, type: "endScreen", headline: { default: "This survey isn't for you" } },
      ],
      startLogic: [
        {
          id: "screenoutrule00000000001",
          conditions: {
            id: "screenoutgroup0000000001",
            connector: "and",
            conditions: [
              {
                id: "screenoutcond00000000001",
                leftOperand: { type: "hiddenField", value: PANEL_FIELD },
                operator: "equals",
                rightOperand: { type: "static", value: "excluded" },
              },
            ],
          },
          actions: [
            {
              id: "screenoutset000000000001",
              objective: "calculate",
              variableId: SEGMENT_VARIABLE,
              operator: "assign",
              value: { type: "static", value: "screened" },
            },
            { id: "screenoutjump00000000001", objective: "jumpToBlock", target: SCREENED_OUT_ENDING },
          ],
        },
      ],
    },
    select: { id: true },
  });

  const declare = async (
    name: string,
    source: "ingested" | "computed",
    storageKey: string,
    order: number
  ) => {
    const field = await prisma.embeddedData.create({
      data: { name, source, dataType: "string", workspaceId: workspace.id, surveyId: survey.id },
    });
    await prisma.surveyEmbeddedData.create({
      data: { workspaceId: workspace.id, surveyId: survey.id, embeddedDataId: field.id, storageKey, order },
    });
  };
  await declare(PANEL_FIELD, "ingested", PANEL_FIELD, 0);
  await declare("segment", "computed", SEGMENT_VARIABLE, 1);

  return { workspaceId: workspace.id, surveyId: survey.id };
};

/** The create the survey sends for a screen-out: no answers, finished, on the screen-out ending. */
const postScreenOut = (workspaceId: string, body: Record<string, unknown>) =>
  POST(
    new Request(`http://localhost/api/v2/client/${workspaceId}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ workspaceId }) }
  );

const screenOutBody = (surveyId: string, extra: Record<string, unknown> = {}) => ({
  surveyId,
  finished: true,
  endingId: SCREENED_OUT_ENDING,
  data: { [PANEL_FIELD]: "excluded" },
  variables: { [SEGMENT_VARIABLE]: "screened" },
  ttc: {},
  language: "default",
  meta: { url: "https://acme.example/s/panel?panel_id=excluded" },
  ...extra,
});

describe("a screen-out before the first question (ENG-6932)", () => {
  test("stores a finished response with its ending, URL parameters and values", async () => {
    const { workspaceId, surveyId } = await seed({ recaptcha: false });

    const res = await postScreenOut(workspaceId, screenOutBody(surveyId));

    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { id: string } };
    await expect(
      prisma.response.findUniqueOrThrow({
        where: { id: data.id },
        select: { surveyId: true, finished: true, endingId: true, data: true, variables: true },
      })
    ).resolves.toEqual({
      surveyId,
      finished: true,
      endingId: SCREENED_OUT_ENDING,
      data: { [PANEL_FIELD]: "excluded" },
      variables: { [SEGMENT_VARIABLE]: "screened" },
    });
    expect(mocks.verifyRecaptchaToken).not.toHaveBeenCalled();
  }, 30_000);

  test("checks the reCAPTCHA token when spam protection is on", async () => {
    const { workspaceId, surveyId } = await seed({ recaptcha: true });

    const res = await postScreenOut(workspaceId, screenOutBody(surveyId, { recaptchaToken: "token-1" }));

    expect(res.status).toBe(200);
    expect(mocks.verifyRecaptchaToken).toHaveBeenCalledWith("token-1", 0.5);
    await expect(prisma.response.count({ where: { surveyId, finished: true } })).resolves.toBe(1);
  }, 30_000);

  test("refuses a screen-out without a token, or one that fails, when spam protection is on", async () => {
    const { workspaceId, surveyId } = await seed({ recaptcha: true });

    const missing = await postScreenOut(workspaceId, screenOutBody(surveyId));
    mocks.verifyRecaptchaToken.mockResolvedValueOnce(false);
    const failed = await postScreenOut(workspaceId, screenOutBody(surveyId, { recaptchaToken: "bot" }));

    expect(missing.status).toBe(400);
    expect(failed.status).toBe(400);
    await expect(prisma.response.count({ where: { surveyId } })).resolves.toBe(0);
  }, 30_000);
});
