import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  type TV3WriteSurveyRow,
  createScopedResponse,
  dispatchV3ResponsePipeline,
  updateScopedResponse,
} from "./write-service";

vi.mock("server-only", () => ({}));

const { mockTransaction, mockSendToPipeline, mockEvaluateQuotas, mockLoggerError } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockSendToPipeline: vi.fn(),
  mockEvaluateQuotas: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: mockTransaction,
    response: { findFirst: vi.fn() },
    survey: { findUnique: vi.fn() },
  },
}));
vi.mock("@formbricks/database/prisma", () => ({
  Prisma: {
    JsonNull: "JsonNull",
    PrismaClientKnownRequestError: class extends Error {
      code: string;
      meta?: { target?: string[] };
      constructor(message: string, code: string, meta?: { target?: string[] }) {
        super(message);
        this.code = code;
        this.meta = meta;
      }
    },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { error: mockLoggerError, warn: vi.fn() } }));
vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: mockSendToPipeline }));
vi.mock("@/modules/ee/quotas/lib/evaluation-service", () => ({ evaluateResponseQuotas: mockEvaluateQuotas }));
vi.mock("@/lib/embedded-data/survey-fields", () => ({
  inlineSurveyEmbeddedFields: () => [],
  selectSurveyEmbeddedDataLinks: {},
}));

const { Prisma } = await import("@formbricks/database/prisma");

/**
 * The mocked constructor takes `(message, code, meta)`; the real one takes `(message, params)`, and
 * `vi.mock` replaces the value without replacing the type. Cast at the one place that builds one
 * rather than spreading `as never` through every assertion below.
 */
const knownRequestError = (message: string, code: string, target?: string[]) =>
  new (Prisma.PrismaClientKnownRequestError as unknown as new (
    message: string,
    code: string,
    meta?: { target?: string[] }
  ) => Error)(message, code, target ? { target } : undefined);

const survey = {
  id: "clsv000000000000000000001",
  workspaceId: "clws000000000000000000001",
} as unknown as TV3WriteSurveyRow;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("unique-constraint races", () => {
  /**
   * `POST` and `PATCH` document no 409, so a race lost to a concurrent write has to land on the same
   * 422 the pre-check would have produced — otherwise losing the race is distinguishable from losing
   * the check, and the endpoint answers a status its own contract does not list.
   */
  test("a singleUseId collision becomes the same 422 issue the pre-check raises", async () => {
    mockTransaction.mockRejectedValueOnce(
      knownRequestError("Unique constraint failed on the fields: (`singleUseId`)", "P2002", [
        "Response_singleUseId_key",
      ])
    );

    const outcome = await createScopedResponse({
      workspaceId: survey.workspaceId,
      survey,
      finished: true,
      data: {},
      variables: {},
      ttc: {},
      meta: undefined,
      tagIds: [],
      endingId: null,
      language: null,
      contactId: undefined,
      displayId: undefined,
      singleUseId: "su-1",
    });

    expect(outcome).toEqual({
      ok: false,
      issues: [expect.objectContaining({ name: "singleUseId", code: "duplicate_identifier" })],
    });
  });

  /** The index name is internal, and naming it in a response body tells a caller about our schema. */
  test("the constraint name never reaches the issue", async () => {
    mockTransaction.mockRejectedValueOnce(knownRequestError("boom", "P2002", ["Response_singleUseId_key"]));

    const outcome = await updateScopedResponse({
      responseId: "clrs000000000000000000001",
      workspaceId: survey.workspaceId,
      survey,
      patch: { finished: true },
    });

    expect(JSON.stringify(outcome)).not.toContain("Response_singleUseId_key");
    expect(JSON.stringify(outcome)).not.toContain("Unique constraint");
  });

  /** Anything that is not a recognised race is still a real failure and must not be swallowed. */
  test("an unrelated Prisma error is rethrown rather than reported as a caller mistake", async () => {
    mockTransaction.mockRejectedValueOnce(knownRequestError("gone", "P2025"));

    await expect(
      updateScopedResponse({
        responseId: "clrs000000000000000000001",
        workspaceId: survey.workspaceId,
        survey,
        patch: { finished: true },
      })
    ).rejects.toThrow("gone");
  });
});

describe("dispatchV3ResponsePipeline", () => {
  /**
   * The row is already committed. A 500 here tells a caller its write failed when it did not, and the
   * retry that follows creates a second response — a missed webhook is recoverable, a duplicated
   * submission is not. `sendToPipeline` rethrows, so this has to be caught somewhere.
   */
  test("a queueing failure does not fail the request", async () => {
    mockSendToPipeline.mockRejectedValue(new Error("redis down"));

    await expect(
      dispatchV3ResponsePipeline({
        event: "responseCreated",
        workspaceId: "clws000000000000000000001",
        surveyId: survey.id,
        response: {},
        alsoFinished: false,
      })
    ).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalled();
  });

  test("a failed first event does not stop the finish event", async () => {
    mockSendToPipeline.mockRejectedValueOnce(new Error("redis down")).mockResolvedValueOnce(undefined);

    await dispatchV3ResponsePipeline({
      event: "responseCreated",
      workspaceId: "clws000000000000000000001",
      surveyId: survey.id,
      response: {},
      alsoFinished: true,
    });

    expect(mockSendToPipeline).toHaveBeenCalledTimes(2);
    expect(mockSendToPipeline.mock.calls[1][0].event).toBe("responseFinished");
  });

  test("a partial response emits one event", async () => {
    mockSendToPipeline.mockResolvedValue(undefined);

    await dispatchV3ResponsePipeline({
      event: "responseUpdated",
      workspaceId: "clws000000000000000000001",
      surveyId: survey.id,
      response: {},
      alsoFinished: false,
    });

    expect(mockSendToPipeline).toHaveBeenCalledTimes(1);
  });
});
