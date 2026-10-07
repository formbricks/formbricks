import { APICallError } from "ai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, TooManyRequestsError } from "@formbricks/types/errors";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TQsfImportResult, TRunQsfImportParams } from "@/modules/survey/import/qsf/pipeline";
import { QSF_IMPORT_DEADLINE_MS, QSF_IMPORT_HEARTBEAT_MS } from "./constants";
import { streamQsfImport } from "./operations";
import type { TQsfImportStreamBody } from "./schemas";

const mocks = vi.hoisted(() => ({
  requireV3WorkspaceAccess: vi.fn(),
  assertOrganizationAIConfigured: vi.fn(),
  runQsfImport: vi.fn(),
  prepareQsfImport: vi.fn(),
  realPrepareQsfImport:
    undefined as unknown as typeof import("@/modules/survey/import/qsf/pipeline").prepareQsfImport,
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: mocks.requireV3WorkspaceAccess }));
vi.mock("@/app/api/v3/surveys/lib/operations", () => ({
  getSessionUserId: (authentication: { user?: { id?: string } }) => authentication?.user?.id ?? null,
}));
vi.mock("@/lib/ai/service", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assertOrganizationAIConfigured: mocks.assertOrganizationAIConfigured,
}));
// The real reader runs, behind a spy a test can make fail; only the AI-backed part is replaced.
vi.mock("@/modules/survey/import/qsf/pipeline", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/survey/import/qsf/pipeline")>();
  mocks.realPrepareQsfImport = original.prepareQsfImport;
  return { ...original, prepareQsfImport: mocks.prepareQsfImport, runQsfImport: mocks.runQsfImport };
});
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => mocks.log), error: vi.fn(), warn: vi.fn() },
}));

/** A marker that must never reach a log line or an error event: it stands for the file's questions. */
const FILE_CONTENT_MARKER = "Q1-secret-wording-from-the-file";

const body: TQsfImportStreamBody = {
  workspaceId: "clxx1234567890123456789012",
  fileName: "onboarding.qsf",
  qsf: {
    SurveyEntry: { SurveyName: "Onboarding" },
    SurveyElements: [{ Element: "SQ", Payload: { QuestionText: FILE_CONTENT_MARKER } }],
  },
};

const importResult: TQsfImportResult = {
  payload: { workspaceId: body.workspaceId, name: "Onboarding (imported)" } as never,
  report: {
    source: { kind: "qsf", fileName: "onboarding.qsf" },
    summary: { blocks: 1, questions: 1, languages: ["en-US"], logicRules: 0, hiddenFields: 0 },
    issues: [],
  },
  usage: { inputTokens: 1200, outputTokens: 300 },
};

const call = (signal?: AbortSignal, qsf: Record<string, unknown> = body.qsf) =>
  streamQsfImport({
    req: new Request("http://localhost/api/internal/surveys/import/stream", {
      method: "POST",
      signal,
      headers: { "content-length": "2048" },
    }),
    authentication: { user: { id: "user_1" } } as never,
    body: { ...body, qsf },
    requestId: "req_1",
    instance: "/api/internal/surveys/import/stream",
  });

const readEvents = async (response: Response) =>
  (await response.text())
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as { type: string; [key: string]: unknown });

/** Every argument any log call received, flattened, to search for leaked file content. */
const allLogged = () =>
  JSON.stringify([...mocks.log.info.mock.calls, ...mocks.log.warn.mock.calls, ...mocks.log.error.mock.calls]);

/** runQsfImport that reports its stages and never finishes until its signal aborts. */
const hangUntilAborted = () =>
  mocks.runQsfImport.mockImplementation(
    ({ signal, onProgress }: TRunQsfImportParams) =>
      new Promise((_resolve, reject) => {
        onProgress("ai");
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      })
  );

describe("streamQsfImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireV3WorkspaceAccess.mockResolvedValue({
      organizationId: "org_1",
      workspaceId: body.workspaceId,
    });
    mocks.assertOrganizationAIConfigured.mockResolvedValue({ isInstanceConfigured: true });
    mocks.prepareQsfImport.mockImplementation(mocks.realPrepareQsfImport);
    mocks.runQsfImport.mockImplementation(async ({ onProgress }: TRunQsfImportParams) => {
      onProgress("ai");
      onProgress("assembling");
      return importResult;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("before the stream opens", () => {
    test("returns the access check's 403 as is and does nothing else", async () => {
      mocks.requireV3WorkspaceAccess.mockResolvedValue(problemForbidden("req_1", "Forbidden"));

      const response = await call();

      expect(response.status).toBe(403);
      expect(mocks.requireV3WorkspaceAccess).toHaveBeenCalledWith(
        expect.anything(),
        body.workspaceId,
        "readWrite",
        "req_1",
        "/api/internal/surveys/import/stream"
      );
      expect(mocks.assertOrganizationAIConfigured).not.toHaveBeenCalled();
      expect(mocks.runQsfImport).not.toHaveBeenCalled();
    });

    test.each([
      ["ai_features_not_enabled", 403],
      ["ai_smart_tools_disabled", 403],
      ["ai_instance_not_configured", 503],
    ])("answers the AI gate reason %s with %i and its own code", async (code, status) => {
      mocks.assertOrganizationAIConfigured.mockRejectedValue(new OperationNotAllowedError(code));

      const response = await call();

      expect(response.status).toBe(status);
      expect(response.headers.get("Content-Type")).toContain("application/problem+json");
      await expect(response.json()).resolves.toMatchObject({ code });
      expect(mocks.runQsfImport).not.toHaveBeenCalled();
    });

    test("answers an exhausted AI quota with 429 and Retry-After", async () => {
      mocks.assertOrganizationAIConfigured.mockRejectedValue(new TooManyRequestsError("quota", 42));

      const response = await call();

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("42");
    });

    test("checks the AI gate before reading the file", async () => {
      mocks.assertOrganizationAIConfigured.mockRejectedValue(
        new OperationNotAllowedError("ai_smart_tools_disabled")
      );

      const response = await call(undefined, { not: "a qsf" });

      expect(response.status).toBe(403);
    });

    test("answers 500 when reading the file fails unexpectedly, and logs where, never what it said", async () => {
      // A reader that fails on the file can quote it, so the message stays out of the log.
      mocks.prepareQsfImport.mockImplementationOnce(() => {
        throw new SyntaxError(`Unexpected token in ${FILE_CONTENT_MARKER}`);
      });

      const response = await call();

      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toContain(FILE_CONTENT_MARKER);
      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ errName: "SyntaxError", operation: "surveys.import", statusCode: 500 }),
        "QSF import could not read the file"
      );
      expect(allLogged()).not.toContain(FILE_CONTENT_MARKER);
      expect(mocks.runQsfImport).not.toHaveBeenCalled();
    });

    test("answers a file that is not a QSF with 422 and what is missing", async () => {
      const response = await call(undefined, { name: "some other JSON" });

      expect(response.status).toBe(422);
      const problem = (await response.json()) as { invalid_params: { name: string }[] };
      expect(problem.invalid_params.map((param) => param.name)).toContain("qsf.SurveyEntry");
      expect(mocks.runQsfImport).not.toHaveBeenCalled();
    });
  });

  describe("the stream", () => {
    test("streams start, each stage, then done with the draft and its report", async () => {
      const response = await call();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("application/x-ndjson");
      await expect(readEvents(response)).resolves.toEqual([
        { type: "start", requestId: "req_1" },
        { type: "progress", stage: "reading" },
        { type: "progress", stage: "ai" },
        { type: "progress", stage: "assembling" },
        { type: "done", payload: importResult.payload, report: importResult.report },
      ]);
      expect(mocks.runQsfImport).toHaveBeenCalledWith(
        expect.objectContaining({
          prepared: { fileName: "onboarding.qsf", surveyName: "Onboarding" },
          workspaceId: body.workspaceId,
          organizationId: "org_1",
          userId: "user_1",
        })
      );
    });

    test("logs the outcome and its numbers, never the file's content", async () => {
      await (await call()).text();

      expect(mocks.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: "done",
          fileBytes: 2048,
          questionCount: 1,
          inputTokens: 1200,
          outputTokens: 300,
          durationMs: expect.any(Number),
        }),
        "QSF import finished"
      );
      expect(allLogged()).not.toContain(FILE_CONTENT_MARKER);
    });

    test("repeats the current stage as a heartbeat while the AI call runs", async () => {
      vi.useFakeTimers();
      let finish: ((result: TQsfImportResult) => void) | undefined;
      mocks.runQsfImport.mockImplementation(
        ({ onProgress }: TRunQsfImportParams) =>
          new Promise<TQsfImportResult>((resolve) => {
            onProgress("ai");
            finish = resolve;
          })
      );

      const response = await call();
      const events = readEvents(response);
      await vi.advanceTimersByTimeAsync(QSF_IMPORT_HEARTBEAT_MS * 2);
      finish?.(importResult);
      await vi.advanceTimersByTimeAsync(0);

      expect((await events).map((event) => event.type === "progress" && event.stage)).toEqual([
        false,
        "reading",
        "ai",
        "ai",
        "ai",
        false,
      ]);
    });

    test("Stop aborts the import, and the stream ends without done or an error", async () => {
      hangUntilAborted();
      const client = new AbortController();

      const response = await call(client.signal);
      const events = readEvents(response);
      await vi.waitFor(() => expect(mocks.runQsfImport).toHaveBeenCalled());
      client.abort();

      const types = (await events).map((event) => event.type);
      expect(types).not.toContain("done");
      expect(types).not.toContain("error");
      const { signal } = mocks.runQsfImport.mock.calls[0][0] as TRunQsfImportParams;
      expect(signal.aborted).toBe(true);
      expect(mocks.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "aborted" }),
        "QSF import finished"
      );
    });

    test("a client cancelling the body aborts the import too", async () => {
      hangUntilAborted();

      const response = await call();
      await vi.waitFor(() => expect(mocks.runQsfImport).toHaveBeenCalled());
      await response.body?.cancel();

      const { signal } = mocks.runQsfImport.mock.calls[0][0] as TRunQsfImportParams;
      expect(signal.aborted).toBe(true);
    });

    test("stops at the deadline and says so", async () => {
      vi.useFakeTimers();
      hangUntilAborted();

      const response = await call();
      const events = readEvents(response);
      await vi.advanceTimersByTimeAsync(QSF_IMPORT_DEADLINE_MS);

      expect((await events).at(-1)).toMatchObject({ type: "error", code: "import_timed_out" });
      expect(mocks.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "timed_out", errorCode: "import_timed_out" }),
        "QSF import finished"
      );
    });

    test("reports a mid-stream AI quota failure with Retry-After", async () => {
      mocks.runQsfImport.mockRejectedValue(new TooManyRequestsError("quota", 30));

      const events = await readEvents(await call());

      expect(events.at(-1)).toEqual(
        expect.objectContaining({ type: "error", code: "ai_quota_exceeded", retryAfter: 30 })
      );
    });

    test("reports any other failure with a fixed message, and logs where it failed, never what it said", async () => {
      // Any error can carry file content in its message — the AI SDK's validation errors carry the
      // model's output — so no error message reaches the log, only its name and frames.
      mocks.runQsfImport.mockRejectedValue(
        new Error(`Failed on ${FILE_CONTENT_MARKER}\nsecond line\n    at ${FILE_CONTENT_MARKER} (looks:1:1)`)
      );

      const events = await readEvents(await call());

      expect(events.at(-1)).toMatchObject({ type: "error", code: "import_failed" });
      expect(JSON.stringify(events)).not.toContain(FILE_CONTENT_MARKER);
      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errName: "Error",
          errStack: expect.stringMatching(/^ +at \S.*(?:\n +at \S.*)*$/),
        }),
        "QSF import failed"
      );
      expect(allLogged()).not.toContain(FILE_CONTENT_MARKER);
      expect(allLogged()).not.toContain("second line");
    });

    test("logs no frames when the message changed after the stack was taken, rather than risk a line of it", async () => {
      const error = new Error(`Failed\n    at ${FILE_CONTENT_MARKER} (looks:1:1)`);
      void error.stack; // V8 writes the header from the message as it is now.
      error.message = "rewritten";
      mocks.runQsfImport.mockRejectedValue(error);

      await (await call()).text();

      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.not.objectContaining({ errStack: expect.anything() }),
        "QSF import failed"
      );
      expect(allLogged()).not.toContain(FILE_CONTENT_MARKER);
    });

    test("keeps the frames of Node's own coded errors, such as a write to a closed stream", async () => {
      // Node writes the code into the header; Vitest rewrites stacks without it, so the header is set
      // here as Node prints it for an enqueue on a closed stream.
      const closedWrite = Object.assign(new TypeError("Invalid state: Controller is already closed"), {
        code: "ERR_INVALID_STATE",
      });
      closedWrite.stack = [
        "TypeError [ERR_INVALID_STATE]: Invalid state: Controller is already closed",
        "    at ReadableStreamDefaultController.enqueue (node:internal/webstreams/readablestream:1077:13)",
        "    at emit (/app/apps/web/app/api/internal/surveys/import/lib/operations.ts:1:1)",
      ].join("\n");
      mocks.runQsfImport.mockRejectedValue(closedWrite);

      await (await call()).text();

      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errName: "TypeError",
          errStack: expect.stringContaining("operations.ts:1:1"),
        }),
        "QSF import failed"
      );
    });

    test("still reports and logs a failure whose message is not a string", async () => {
      const error = new Error("boom");
      Object.defineProperty(error, "message", { value: undefined });
      mocks.runQsfImport.mockRejectedValue(error);

      const events = await readEvents(await call());

      expect(events.at(-1)).toMatchObject({ type: "error", code: "import_failed" });
      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ errName: "Error" }),
        "QSF import failed"
      );
    });

    test("logs a provider error by name and status only, since its message can echo the prompt", async () => {
      mocks.runQsfImport.mockRejectedValue(
        new APICallError({
          message: `Provider rejected the prompt: ${FILE_CONTENT_MARKER}`,
          url: "https://provider.example/v1/chat",
          requestBodyValues: {},
          statusCode: 500,
        })
      );

      await (await call()).text();

      expect(mocks.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ errName: "AI_APICallError", providerStatusCode: 500 }),
        "QSF import failed"
      );
      expect(allLogged()).not.toContain(FILE_CONTENT_MARKER);
    });
  });
});
