import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { cubeFake, resetCubeFake } from "@/integration/cube-fake";
import {
  type TDashboardsFixture,
  apiKeyOf,
  outcomeOf,
  seedDashboardsFixture,
  sessionOf,
} from "@/integration/dashboards-fixture";
import { AI_CHART_PROMPT_ERROR_CODE } from "@/modules/ee/analysis/charts/lib/ai-chart-errors";
import { generateInternalChart, listInternalMatrixQuestions } from "./operations";

/**
 * The app-only chart operations (ENG-6583) against real PostgreSQL and SpiceDB, with the model and Cube
 * faked at their boundaries: the same access as the public chart API, and nothing reaches the model or
 * Cube for a caller who may not.
 */

const ai = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/modules/ee/analysis/charts/lib/ai-chart-query.server", () => ({
  generateAIChartQuery: ai.generate,
}));
vi.mock("@cubejs-client/core", async (importOriginal) =>
  (await import("@/integration/cube-fake")).fakeCubeModule(await importOriginal())
);
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
}));

let fixture: TDashboardsFixture;

const context = (authentication = sessionOf(fixture.users.viewer)) => ({
  authentication,
  requestId: "req",
  instance: "/api/internal/charts/generate",
});

const generate = (
  body: Partial<{ datasetId: string; prompt: string }> = {},
  authentication?: ReturnType<typeof sessionOf>
) =>
  generateInternalChart({
    body: {
      workspaceId: fixture.workspaceId,
      datasetId: fixture.datasetId,
      prompt: "responses by source",
      ...body,
    },
    ...context(authentication),
  });

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
}, 120_000);

beforeEach(() => {
  ai.generate.mockReset();
  resetCubeFake();
});

describe("POST /api/internal/charts/generate", () => {
  test("hands the model the dataset and user, runs the query for that user, and returns the unsaved chart", async () => {
    ai.generate.mockResolvedValueOnce({
      chartType: "bar",
      query: { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.sourceType"] },
      name: "Responses by source",
    });
    cubeFake.rows = [{ "FeedbackRecords.count": 4, "FeedbackRecords.sourceType": "survey" }];

    const response = await generate();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      chartType: "bar",
      query: { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.sourceType"] },
      data: [{ "FeedbackRecords.count": 4, "FeedbackRecords.sourceType": "survey" }],
      suggestedName: "Responses by source",
    });

    expect(ai.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: fixture.organizationId,
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: fixture.datasetId,
        userId: fixture.users.viewer,
        prompt: "responses by source",
      })
    );
    expect(cubeFake.calls).toHaveLength(1);
    expect(cubeFake.calls[0].claims).toMatchObject({
      userId: fixture.users.viewer,
      feedbackDirectoryId: fixture.datasetId,
    });
  });

  test("never reaches the model for a caller without the workspace, the dataset, or a session", async () => {
    const refused = [
      await generate({}, sessionOf(fixture.users.outsider)),
      await generate({ datasetId: fixture.unassignedDatasetId }, sessionOf(fixture.users.owner)),
      await generate({}, apiKeyOf(fixture, "manageKey")),
    ];
    for (const response of refused) {
      expect((await outcomeOf(response)).status).toBe(403);
    }
    expect(ai.generate).not.toHaveBeenCalled();
    expect(cubeFake.calls).toHaveLength(0);
  });

  test("answers a prompt the model cannot turn into a chart with 422 on the prompt, running nothing", async () => {
    ai.generate.mockRejectedValueOnce(new InvalidInputError(AI_CHART_PROMPT_ERROR_CODE));

    const response = await generate();
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "ai_generated_payload_invalid",
      invalid_params: [{ name: "prompt" }],
    });
    expect(cubeFake.calls).toHaveLength(0);
  });
});

describe("GET /api/internal/matrix-questions", () => {
  test("lists a dataset's matrix questions for a reader, and refuses a dataset the workspace does not use", async () => {
    const list = (datasetId: string, authentication = sessionOf(fixture.users.viewer)) =>
      listInternalMatrixQuestions({
        query: { workspaceId: fixture.workspaceId, datasetId },
        authentication,
        requestId: "req",
        instance: "/api/internal/matrix-questions",
      });

    const response = await list(fixture.datasetId);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([]);

    expect(
      (await outcomeOf(await list(fixture.unassignedDatasetId, sessionOf(fixture.users.owner)))).status
    ).toBe(403);
    expect((await outcomeOf(await list(fixture.datasetId, sessionOf(fixture.users.outsider)))).status).toBe(
      403
    );
  });
});
