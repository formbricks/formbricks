import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, TooManyRequestsError } from "@formbricks/types/errors";
import { ZV3SurveyImportConvertBody } from "@/app/api/v3/surveys/import/convert/schemas";
import { ImportInProgressError } from "@/modules/survey/import/lib/ai-inflight-guard";
import type { TImportContext, TImportLaneHandler } from "@/modules/survey/import/types";
import { streamImportConversion } from "./operations";

const mocks = vi.hoisted(() => ({
  requireV3WorkspaceAccess: vi.fn(),
  assertOrganizationAIConfigured: vi.fn(),
  applyRateLimit: vi.fn(),
  getImportLaneHandler: vi.fn(),
  resolveImportCandidate: vi.fn(),
  capturePostHogEvent: vi.fn(),
  acquireAiImportSlot: vi.fn(),
  releaseAiImportSlot: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: mocks.requireV3WorkspaceAccess }));
vi.mock("@/lib/ai/service", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assertOrganizationAIConfigured: mocks.assertOrganizationAIConfigured,
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/survey/import/lib/ai-inflight-guard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/survey/import/lib/ai-inflight-guard")>()),
  acquireAiImportSlot: mocks.acquireAiImportSlot,
}));
vi.mock("@/modules/survey/import/lanes", () => ({ getImportLaneHandler: mocks.getImportLaneHandler }));
vi.mock("@/modules/survey/import/resolve", () => ({ resolveImportCandidate: mocks.resolveImportCandidate }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));

const workspaceId = "clxx1234567890123456789012";
const FIXTURES = join(process.cwd(), "modules/survey/import/lanes/document/__fixtures__");

const body = (fileName: string, bytes: Buffer, language?: string) =>
  ZV3SurveyImportConvertBody.parse({
    fields: { workspaceId, ...(language ? { language } : {}) },
    files: [{ name: "file", fileName, mimeType: "application/octet-stream", bytes }],
  });

const call = (parsed: ReturnType<typeof body>, signal?: AbortSignal) =>
  streamImportConversion({
    req: new Request("http://localhost/api/internal/surveys/import/stream", { method: "POST", signal }),
    authentication: { user: { id: "user1" }, expires: "2099-01-01" } as never,
    body: parsed,
    requestId: "req_1",
    instance: "/api/internal/surveys/import/stream",
  });

const readEvents = async (response: Response) =>
  (await response.text())
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));

const resolved = {
  document: { name: "Doc", blocks: [] },
  createBody: { workspaceId, name: "Doc" },
  report: {
    source: { lane: "ai", kind: "markdown", chunks: 2 },
    summary: { elements: 3, languages: ["en-US"] },
    issues: [],
  },
  validation: { valid: true, invalid_params: [] },
};

describe("streamImportConversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireV3WorkspaceAccess.mockResolvedValue({ organizationId: "org1", workspaceId });
    mocks.assertOrganizationAIConfigured.mockResolvedValue({});
    mocks.applyRateLimit.mockResolvedValue({});
    mocks.resolveImportCandidate.mockResolvedValue(resolved);
    mocks.acquireAiImportSlot.mockResolvedValue(mocks.releaseAiImportSlot);
  });

  test("a deterministic lane emits start, reading, validating and done — no partials", async () => {
    const lane: TImportLaneHandler = vi.fn(async (input) => ({
      document: { name: "Q" },
      issues: [],
      source: { lane: "structured" as const, kind: input.kind, fileName: input.fileName },
    }));
    mocks.getImportLaneHandler.mockReturnValue(lane);
    const qsf = readFileSync(join(process.cwd(), "modules/survey/import/lanes/qsf/__fixtures__/simple.qsf"));

    const response = await call(body("survey.qsf", qsf));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/x-ndjson; charset=utf-8");
    const events = await readEvents(response);
    expect(events.map((event) => event.type)).toEqual(["start", "progress", "progress", "done"]);
    expect(events[0]).toMatchObject({
      requestId: "req_1",
      source: { lane: "structured", kind: "qsf", fileName: "survey.qsf" },
    });
    expect(events.filter((event) => event.type === "progress").map((event) => event.stage)).toEqual([
      "reading",
      "validating",
    ]);
    expect(events.at(-1)).toMatchObject({
      payload: resolved.createBody,
      document: resolved.document,
      references: null,
    });
    expect(mocks.assertOrganizationAIConfigured).not.toHaveBeenCalled();
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("an AI lane run streams progress per chunk and partials with their block offset", async () => {
    const lane: TImportLaneHandler = vi.fn(async (input, ctx: TImportContext) => {
      ctx.onProgress?.({ stage: "reading" });
      ctx.onProgress?.({ stage: "detecting_languages" });
      for (const index of [1, 2]) {
        ctx.onProgress?.({ stage: "extracting", chunk: { index, total: 2 } });
        // The snapshot throttle is 100 ms; space the partials so both are worth emitting.
        if (index > 1) await new Promise((resolve) => setTimeout(resolve, 120));
        ctx.onPartial?.({ name: `part ${index}` }, index - 1);
      }
      ctx.onProgress?.({ stage: "validating" });
      return { document: { name: "Doc" }, issues: [], source: { lane: "ai" as const, kind: input.kind } };
    });
    mocks.getImportLaneHandler.mockReturnValue(lane);

    const response = await call(body("survey.md", readFileSync(join(FIXTURES, "survey.md")), "de-DE"));

    const events = await readEvents(response);
    expect(events.map((event) => event.type)).toEqual([
      "start",
      "progress",
      "progress",
      "progress",
      "partial",
      "progress",
      "partial",
      "progress",
      "done",
    ]);
    expect(
      events.filter((event) => event.type === "progress").map((event) => event.chunk?.index ?? event.stage)
    ).toEqual(["reading", "detecting_languages", 1, 2, "validating"]);
    const partials = events.filter((event) => event.type === "partial");
    expect(partials).toEqual([
      { type: "partial", seq: 1, blockOffset: 0, draft: { name: "part 1" } },
      { type: "partial", seq: 2, blockOffset: 1, draft: { name: "part 2" } },
    ]);
    expect(mocks.assertOrganizationAIConfigured).toHaveBeenCalledWith("org1");
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "api:v3:surveys:generate" }),
      "user1"
    );
    const ctx = vi.mocked(lane).mock.calls[0][1];
    expect(ctx.languageHint).toBe("de-DE");
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      "user1",
      "ai_survey_imported",
      expect.objectContaining({ source_kind: "markdown", chunk_count: 2, streamed: true }),
      expect.objectContaining({ workspaceId })
    );
  });

  test("an unentitled organization gets problem+json and the body is never opened", async () => {
    mocks.assertOrganizationAIConfigured.mockRejectedValueOnce(
      new OperationNotAllowedError("ai_smart_tools_disabled")
    );
    const lane = vi.fn();
    mocks.getImportLaneHandler.mockReturnValue(lane);

    const response = await call(body("survey.md", readFileSync(join(FIXTURES, "survey.md"))));

    expect(response.status).toBe(403);
    expect(response.headers.get("Content-Type")).toContain("application/problem+json");
    expect(lane).not.toHaveBeenCalled();
  });

  test("a spent AI budget answers 429 with Retry-After before the stream", async () => {
    mocks.applyRateLimit.mockRejectedValueOnce(new TooManyRequestsError("slow", 17));
    mocks.getImportLaneHandler.mockReturnValue(vi.fn());

    const response = await call(body("survey.md", readFileSync(join(FIXTURES, "survey.md"))));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
  });

  test("a third concurrent AI conversion is a 409 before the stream; the slot is released after the stream", async () => {
    mocks.acquireAiImportSlot.mockRejectedValueOnce(new ImportInProgressError());
    mocks.getImportLaneHandler.mockReturnValue(vi.fn());
    const refused = await call(body("survey.md", readFileSync(join(FIXTURES, "survey.md"))));
    expect(refused.status).toBe(409);
    expect(refused.headers.get("Retry-After")).toBe("30");

    mocks.getImportLaneHandler.mockReturnValue(
      vi.fn(async (input) => ({
        document: { name: "Doc" },
        issues: [],
        source: { lane: "ai" as const, kind: input.kind },
      }))
    );
    await readEvents(await call(body("survey.md", readFileSync(join(FIXTURES, "survey.md")))));
    expect(mocks.releaseAiImportSlot).toHaveBeenCalledTimes(1);
  });

  test("an unsupported file is a 422 problem, a kind without a lane a 400", async () => {
    expect((await call(body("photo.png", Buffer.from("\x89PNG")))).status).toBe(422);
    mocks.getImportLaneHandler.mockReturnValue(null);
    const response = await call(body("survey.md", readFileSync(join(FIXTURES, "survey.md"))));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("lane_not_available");
  });

  test("an abort after the first chunk stops the lane and closes the stream without an error event", async () => {
    const controller = new AbortController();
    const lane: TImportLaneHandler = vi.fn(async (_input, ctx: TImportContext) => {
      ctx.onProgress?.({ stage: "extracting", chunk: { index: 1, total: 3 } });
      controller.abort();
      if (ctx.signal?.aborted) throw new DOMException("aborted", "AbortError");
      throw new Error("should have aborted");
    });
    mocks.getImportLaneHandler.mockReturnValue(lane);

    const response = await call(
      body("survey.md", readFileSync(join(FIXTURES, "survey.md"))),
      controller.signal
    );
    const events = await readEvents(response);

    expect(events.map((event) => event.type)).toEqual(["start", "progress", "progress"]);
    expect(mocks.resolveImportCandidate).not.toHaveBeenCalled();
  });

  test("a provider failure mid-stream becomes an in-band error event", async () => {
    mocks.getImportLaneHandler.mockReturnValue(
      vi.fn(async () => {
        throw new TooManyRequestsError("quota", 30);
      })
    );

    const events = await readEvents(await call(body("survey.md", readFileSync(join(FIXTURES, "survey.md")))));

    expect(events.at(-1)).toMatchObject({
      type: "error",
      code: "ai_quota_exceeded",
      retryAfter: 30,
      reference: expect.any(String),
    });
  });
});
