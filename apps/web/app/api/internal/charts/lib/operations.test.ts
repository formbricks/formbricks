import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { problemDashboardsPlanRequired, problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { RedactedAIError } from "@/lib/ai/loggable-error";
import { CubeQueryError } from "@/modules/ee/analysis/api/lib/cube-client";
import { AI_CHART_PROMPT_ERROR_CODE } from "@/modules/ee/analysis/charts/lib/ai-chart-errors";
import { generateAIChartQuery } from "@/modules/ee/analysis/charts/lib/ai-chart-query.server";
import { getMatrixQuestions } from "@/modules/ee/analysis/charts/lib/matrix-questions";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import { generateInternalChart, listInternalMatrixQuestions } from "./operations";

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { withContext: vi.fn(() => log) } }));
vi.mock("@/app/api/v3/charts/lib/service", () => ({ getChartResourceRow: vi.fn() }));
vi.mock("@/app/api/v3/lib/dashboards-access", () => ({
  requireDashboardsAccess: vi.fn(),
  refuseUnlessFeedbackDatasetAccess: vi.fn(),
}));
vi.mock("@/modules/ee/analysis/charts/lib/ai-chart-query.server", () => ({ generateAIChartQuery: vi.fn() }));
vi.mock("@/modules/ee/analysis/lib/run-chart-query", () => ({ runChartQuery: vi.fn() }));
vi.mock("@/modules/ee/analysis/charts/lib/matrix-questions", () => ({ getMatrixQuestions: vi.fn() }));
vi.mock("@/modules/ee/analysis/api/lib/cube-client", () => ({
  CubeQueryError: class CubeQueryError extends Error {
    constructor(readonly timedOut: boolean) {
      super("Cube query failed.");
      this.name = "CubeQueryError";
    }
  },
}));

const WORKSPACE_ID = "clws000000000000000000001";
const ORGANIZATION_ID = "clorg00000000000000000001";
const DATASET_ID = "clds000000000000000000001";
const USER_ID = "clus000000000000000000001";
const INSTANCE = "/api/internal/charts/generate";
const access = { workspaceId: WORKSPACE_ID, organizationId: ORGANIZATION_ID };

const session = { user: { id: USER_ID }, expires: "2099-01-01" } as unknown as TV3Authentication;
const apiKey = { type: "apiKey", apiKeyId: "key_1" } as unknown as TV3Authentication;

const validQuery = {
  measures: ["FeedbackRecords.count"],
  dimensions: ["FeedbackRecords.sourceType"],
};

const generate = (authentication: TV3Authentication = session, prompt = "responses by source") =>
  generateInternalChart({
    body: { workspaceId: WORKSPACE_ID, datasetId: DATASET_ID, prompt },
    authentication,
    requestId: "req",
    instance: INSTANCE,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireDashboardsAccess).mockResolvedValue(access);
  vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValue(null);
});

describe("generateInternalChart", () => {
  test("returns the validated, unsaved chart with its rows, labels and suggested name", async () => {
    vi.mocked(generateAIChartQuery).mockResolvedValue({
      chartType: "bar",
      query: validQuery,
      name: "Responses by source",
    } as Awaited<ReturnType<typeof generateAIChartQuery>>);
    vi.mocked(runChartQuery).mockResolvedValue({
      rows: [{ "FeedbackRecords.count": 4, "FeedbackRecords.sourceType": "survey" }],
      optionLabels: { a: "Option A" },
      fieldLabels: { "FeedbackRecords.count": "Responses" },
      effectiveQuery: validQuery,
    } as Awaited<ReturnType<typeof runChartQuery>>);

    const response = await generate();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      chartType: "bar",
      query: validQuery,
      data: [{ "FeedbackRecords.count": 4, "FeedbackRecords.sourceType": "survey" }],
      optionLabels: { a: "Option A" },
      fieldLabels: { "FeedbackRecords.count": "Responses" },
      suggestedName: "Responses by source",
    });
    expect(generateAIChartQuery).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      workspaceId: WORKSPACE_ID,
      feedbackDirectoryId: DATASET_ID,
      userId: USER_ID,
      prompt: "responses by source",
    });
    expect(runChartQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        datasetId: DATASET_ID,
        workspaceId: WORKSPACE_ID,
        organizationId: ORGANIZATION_ID,
        actor: { type: "user", id: USER_ID },
        source: "internal.charts.generate",
      })
    );
  });

  test("leaves out labels and the suggested name when there are none", async () => {
    vi.mocked(generateAIChartQuery).mockResolvedValue({
      chartType: "bar",
      query: validQuery,
      name: "",
    } as Awaited<ReturnType<typeof generateAIChartQuery>>);
    vi.mocked(runChartQuery).mockResolvedValue({
      rows: [],
      effectiveQuery: validQuery,
    } as unknown as Awaited<ReturnType<typeof runChartQuery>>);

    const data = (await (await generate()).json()).data;

    expect(Object.keys(data).sort()).toEqual(["chartType", "data", "query"]);
  });

  test("refuses an API key with 403 before checking any access, since generation is session-only", async () => {
    const response = await generate(apiKey);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "forbidden", instance: INSTANCE });
    expect(requireDashboardsAccess).not.toHaveBeenCalled();
    expect(generateAIChartQuery).not.toHaveBeenCalled();
  });

  test("passes a workspace or plan refusal through without reaching the model", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValueOnce(problemDashboardsPlanRequired("req", INSTANCE));

    const response = await generate();

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "dashboards_plan_required" });
    expect(refuseUnlessFeedbackDatasetAccess).not.toHaveBeenCalled();
    expect(generateAIChartQuery).not.toHaveBeenCalled();
  });

  test("checks read access to the dataset and stops on a refusal before the model", async () => {
    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValueOnce(
      problemForbidden("req", "You are not authorized to use this Feedback Dataset", INSTANCE)
    );

    const response = await generate();

    expect(response.status).toBe(403);
    expect(refuseUnlessFeedbackDatasetAccess).toHaveBeenCalledWith(
      session,
      access,
      DATASET_ID,
      "read",
      "req",
      INSTANCE
    );
    expect(generateAIChartQuery).not.toHaveBeenCalled();
  });

  test("answers 422 on the prompt when the model cannot turn it into a chart", async () => {
    vi.mocked(generateAIChartQuery).mockRejectedValue(new InvalidInputError(AI_CHART_PROMPT_ERROR_CODE));

    const response = await generate();

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "ai_generated_payload_invalid",
      invalid_params: [{ name: "prompt", reason: expect.stringContaining("Name a metric") }],
    });
    expect(runChartQuery).not.toHaveBeenCalled();
  });

  test("does not treat any other invalid input as an unchartable prompt, nor blame the provider for it", async () => {
    vi.mocked(generateAIChartQuery).mockRejectedValue(new InvalidInputError("something else"));

    const response = await generate();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("AI provider");
  });

  test("does not blame the AI provider for the app's own failure inside the generation call", async () => {
    // The organization lookup and the license check run inside generateAIChartQuery, before the provider.
    vi.mocked(generateAIChartQuery).mockRejectedValue(new DatabaseError("connection terminated"));

    const response = await generate();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("AI provider");
  });

  test("does not blame the AI provider for a failure while running the generated query", async () => {
    vi.mocked(generateAIChartQuery).mockResolvedValue({
      chartType: "bar",
      query: validQuery,
      name: "Responses by source",
    } as Awaited<ReturnType<typeof generateAIChartQuery>>);
    vi.mocked(runChartQuery).mockRejectedValue(new Error("option grouping lookup failed"));

    const response = await generate();

    expect(runChartQuery).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("AI provider");
  });

  test("answers 422 and runs nothing when the validator refuses the model's query", async () => {
    vi.mocked(generateAIChartQuery).mockResolvedValue({
      chartType: "bar",
      query: { measures: ["FeedbackRecords.notAField"] },
      name: "Nope",
    } as unknown as Awaited<ReturnType<typeof generateAIChartQuery>>);

    const response = await generate();

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "ai_generated_payload_invalid",
      invalid_params: [{ name: "prompt", reason: expect.stringContaining("Name a metric") }],
    });
    expect(body.invalid_params[0].reason).not.toContain("Ask for a shorter period");
    expect(runChartQuery).not.toHaveBeenCalled();
  });

  test("says to ask for a shorter period when the query spans too many time buckets", async () => {
    vi.mocked(generateAIChartQuery).mockResolvedValue({
      chartType: "line",
      name: "Every hour since 2000",
      query: {
        measures: ["FeedbackRecords.count"],
        timeDimensions: [
          {
            dimension: "FeedbackRecords.collectedAt",
            granularity: "hour",
            dateRange: ["2000-01-01", "2026-12-31"],
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof generateAIChartQuery>>);

    const response = await generate();

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "ai_generated_payload_invalid",
      invalid_params: [{ name: "prompt", reason: expect.stringContaining("Ask for a shorter period") }],
    });
    expect(runChartQuery).not.toHaveBeenCalled();
  });

  test("answers 502 when Cube cannot run the generated query", async () => {
    vi.mocked(generateAIChartQuery).mockResolvedValue({
      chartType: "bar",
      query: validQuery,
      name: "x",
    } as Awaited<ReturnType<typeof generateAIChartQuery>>);
    vi.mocked(runChartQuery).mockRejectedValue(new CubeQueryError(false));

    const response = await generate();

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: "bad_gateway",
      detail: "The generated chart could not be run. Try again shortly.",
    });
    expect(log.error).not.toHaveBeenCalled();
  });

  test("maps a rate-limited provider to 429 with its Retry-After", async () => {
    vi.mocked(generateAIChartQuery).mockRejectedValue(new TooManyRequestsError("slow down", 30));

    const response = await generate();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  test("maps AI switched off for the organization to its own 403 code", async () => {
    vi.mocked(generateAIChartQuery).mockRejectedValue(
      new OperationNotAllowedError("ai_smart_tools_disabled")
    );

    const response = await generate();

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "ai_smart_tools_disabled" });
  });

  test("does not blame the AI provider for a failure before the model is called", async () => {
    vi.mocked(requireDashboardsAccess).mockRejectedValueOnce(new Error("connection terminated"));

    const response = await generate();

    expect(response.status).toBe(500);
    expect(generateAIChartQuery).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain("AI provider");
  });

  test("answers a provider failure with a generic 502, logging no message that could carry the prompt", async () => {
    // What generateAIChartQuery throws for an AI SDK error: redacted, never the original.
    vi.mocked(generateAIChartQuery).mockRejectedValue(
      new RedactedAIError(new Error("model said: responses by source"))
    );

    const response = await generate();

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: "bad_gateway",
      detail: "The AI provider could not generate a chart. Try again or add more detail.",
    });
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.error.mock.calls[0][0])).not.toContain("responses by source");
    expect(logger.withContext).toHaveBeenCalledWith({ requestId: "req", workspaceId: WORKSPACE_ID });
  });
});

describe("listInternalMatrixQuestions", () => {
  const list = () =>
    listInternalMatrixQuestions({
      query: { workspaceId: WORKSPACE_ID, datasetId: DATASET_ID },
      authentication: session,
      requestId: "req",
      instance: "/api/internal/matrix-questions",
    });

  test("lists the dataset's matrix questions for the resolved workspace", async () => {
    const questions = [{ label: "Rate each", rows: ["Speed"], columns: ["Good"] }];
    vi.mocked(getMatrixQuestions).mockResolvedValue(
      questions as unknown as Awaited<ReturnType<typeof getMatrixQuestions>>
    );

    const response = await list();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(questions);
    expect(getMatrixQuestions).toHaveBeenCalledWith(WORKSPACE_ID, DATASET_ID);
  });

  test("passes a workspace refusal through", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValueOnce(problemForbidden("req"));

    expect((await list()).status).toBe(403);
    expect(getMatrixQuestions).not.toHaveBeenCalled();
  });

  test("passes a dataset refusal through", async () => {
    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValueOnce(problemForbidden("req"));

    expect((await list()).status).toBe(403);
    expect(getMatrixQuestions).not.toHaveBeenCalled();
  });

  test("maps a thrown error through the v3 error mapper", async () => {
    vi.mocked(getMatrixQuestions).mockRejectedValue(new DatabaseError("connection lost"));

    const response = await list();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("connection lost");
  });
});
