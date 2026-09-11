import { beforeEach, describe, expect, test, vi } from "vitest";
import { ZResponse } from "@formbricks/types/responses";
import {
  type TV3CreateResponsePersist,
  type TV3WriteReadbackRow,
  type TV3WriteSurveyRow,
  createScopedResponse,
  dispatchV3ResponsePipeline,
  getSurveyForV3Write,
  readbackV3Response,
  toV3PipelineResponse,
  updateScopedResponse,
} from "./write-service";

vi.mock("server-only", () => ({}));

const {
  mockTransaction,
  mockSendToPipeline,
  mockEvaluateQuotas,
  mockLoggerError,
  mockResponseFindFirst,
  mockSurveyFindUnique,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockSendToPipeline: vi.fn(),
  mockEvaluateQuotas: vi.fn(),
  mockLoggerError: vi.fn(),
  mockResponseFindFirst: vi.fn(),
  mockSurveyFindUnique: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: mockTransaction,
    response: { findFirst: mockResponseFindFirst },
    survey: { findUnique: mockSurveyFindUnique },
  },
}));
vi.mock("@formbricks/database/prisma", () => ({
  Prisma: {
    JsonNull: "JsonNull",
    PrismaClientKnownRequestError: class extends Error {
      code: string;
      meta?: Record<string, unknown>;
      constructor(message: string, code: string, meta?: Record<string, unknown>) {
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
const knownRequestError = (message: string, code: string, meta?: Record<string, unknown>) =>
  new (Prisma.PrismaClientKnownRequestError as unknown as new (
    message: string,
    code: string,
    meta?: Record<string, unknown>
  ) => Error)(message, code, meta);

/**
 * A P2002 in the shape THIS repo actually produces.
 *
 * Prisma 7 + `@prisma/adapter-pg` leaves `meta.target` absent and puts the columns at
 * `meta.driverAdapterError.cause.constraint.fields`, still quoted exactly as Postgres emitted them
 * — the adapter scrapes them out of the error DETAIL and never unquotes. A handler written against
 * `meta.target` matches nothing here, which is a 500 on every real race.
 */
const adapterUniqueError = (...fields: string[]) =>
  knownRequestError("Unique constraint failed", "P2002", {
    driverAdapterError: { cause: { constraint: { fields } } },
  });

/** The library/legacy engine shape, which the shared helper still accepts. */
const legacyUniqueError = (...fields: string[]) =>
  knownRequestError("Unique constraint failed", "P2002", { target: fields });

const survey = {
  id: "clsv000000000000000000001",
  workspaceId: "clws000000000000000000001",
} as unknown as TV3WriteSurveyRow;

/** A read-back row in the exact shape `v3WriteReadbackSelect` produces — join rows and all. */
const readbackRow = (over: Record<string, unknown> = {}): TV3WriteReadbackRow =>
  ({
    id: "clrs000000000000000000001",
    surveyId: survey.id,
    createdAt: new Date("2026-09-11T10:00:00.000Z"),
    updatedAt: new Date("2026-09-11T10:05:00.000Z"),
    finished: true,
    endingId: null,
    language: "de",
    data: { q1: "hi" },
    variables: {},
    ttc: { q1: 1200, _total: 1200 },
    meta: { source: "smoke" },
    displayId: null,
    singleUseId: null,
    contactAttributes: { userId: "user-42" },
    contact: { id: "clct000000000000000000001", attributes: [{ value: "user-42" }] },
    tags: [
      {
        tag: {
          id: "cltg000000000000000000001",
          createdAt: new Date("2026-09-01T10:00:00.000Z"),
          updatedAt: new Date("2026-09-01T10:00:00.000Z"),
          name: "tag-a",
          workspaceId: survey.workspaceId,
        },
      },
    ],
    ...over,
  }) as unknown as TV3WriteReadbackRow;

/**
 * A transaction client stub, so the callback the service passes to `$transaction` actually runs.
 * Mocking `$transaction` to resolve or reject skips the body entirely — which is where the scoped
 * `where` clauses, the tag join shape and the reference checks all live.
 */
const txStub = (over: Record<string, unknown> = {}) => ({
  contact: { findFirst: vi.fn().mockResolvedValue({ id: "clct000000000000000000001", attributes: [] }) },
  display: { findFirst: vi.fn().mockResolvedValue({ id: "cldp1", response: null }) },
  tag: { findMany: vi.fn().mockResolvedValue([]) },
  response: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "clrs1", finished: false, data: {}, variables: {} }),
    update: vi
      .fn()
      .mockResolvedValue({ id: "clrs1", finished: false, data: {}, variables: {}, language: null }),
  },
  ...over,
});

const runTx = (tx: ReturnType<typeof txStub>) => {
  mockTransaction.mockImplementationOnce(async (fn: (client: unknown) => Promise<unknown>) => fn(tx));
  return tx;
};

const createInput = (over: Partial<TV3CreateResponsePersist> = {}): TV3CreateResponsePersist => ({
  workspaceId: survey.workspaceId,
  survey,
  finished: false,
  data: { q1: "hi" },
  variables: {},
  ttc: {},
  meta: undefined,
  tagIds: [],
  endingId: null,
  language: null,
  contactId: undefined,
  displayId: undefined,
  singleUseId: undefined,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockEvaluateQuotas.mockResolvedValue({ shouldEndSurvey: false });
});

describe("unique-constraint races", () => {
  /**
   * `POST` and `PATCH` document no 409, so a race lost to a concurrent write has to land on the same
   * 422 the pre-check would have produced — otherwise losing the race is distinguishable from losing
   * the check, and the endpoint answers a status its own contract does not list.
   */
  test("a singleUseId collision becomes the same 422 issue the pre-check raises", async () => {
    mockTransaction.mockRejectedValueOnce(adapterUniqueError('"surveyId"', '"singleUseId"'));

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

  /**
   * The index name is internal, and the Postgres DETAIL behind it carries the offending VALUES —
   * `Key ("surveyId", "singleUseId")=(…, …) already exists`, i.e. the single-use token itself.
   * Neither may reach the body, which is why only the structured column list is read.
   */
  test("neither the constraint name nor the offending value reaches the issue", async () => {
    mockTransaction.mockRejectedValueOnce(
      knownRequestError("Unique constraint failed on the constraint: `Response_singleUseId_key`", "P2002", {
        driverAdapterError: {
          cause: {
            constraint: { fields: ['"surveyId"', '"singleUseId"'] },
            originalMessage: 'Key ("surveyId", "singleUseId")=(clsv1, secret-token-abc) already exists',
          },
        },
      })
    );

    const outcome = await updateScopedResponse({
      responseId: "clrs000000000000000000001",
      workspaceId: survey.workspaceId,
      survey,
      patch: { finished: true },
    });

    expect(JSON.stringify(outcome)).not.toContain("Response_singleUseId_key");
    expect(JSON.stringify(outcome)).not.toContain("Unique constraint");
    expect(JSON.stringify(outcome)).not.toContain("secret-token-abc");
  });

  /**
   * The same violation in the library-engine shape. Both are accepted because the shared helper
   * reads both, and a test that only covered this one is exactly how the adapter shape got missed.
   */
  test("the legacy meta.target shape maps to the same issue", async () => {
    mockTransaction.mockRejectedValueOnce(legacyUniqueError("surveyId", "singleUseId"));

    const outcome = await createScopedResponse(createInput({ singleUseId: "su-1" }));

    expect(outcome).toEqual({
      ok: false,
      issues: [expect.objectContaining({ name: "singleUseId", code: "duplicate_identifier" })],
    });
  });

  test("a displayId collision names displayId, not singleUseId", async () => {
    mockTransaction.mockRejectedValueOnce(adapterUniqueError('"displayId"'));

    const outcome = await createScopedResponse(createInput({ displayId: "cldp1" }));

    expect(outcome).toEqual({
      ok: false,
      issues: [expect.objectContaining({ name: "displayId", code: "duplicate_identifier" })],
    });
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
        response: readbackRow(),
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
      response: readbackRow(),
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
      response: readbackRow(),
      alsoFinished: false,
    });

    expect(mockSendToPipeline).toHaveBeenCalledTimes(1);
  });
});

describe("toV3PipelineResponse", () => {
  /**
   * The guard for the defect a live create exposed. `enqueueResponsePipeline` parses its payload
   * against `ZResponse` in-request, and the stored row's `tags` are join rows while `contact` carries
   * an attribute row. Handing the raw row over throws inside `sendToPipeline` — and because dispatch
   * is deliberately non-fatal, the create still answered 201 while no webhook, integration,
   * follow-up or Hub ingestion ran, with nothing in the reply to say so.
   */
  test("the payload parses against the schema the queue validates with", () => {
    const parsed = ZResponse.safeParse(toV3PipelineResponse(readbackRow()));

    expect(parsed.error?.issues).toBeUndefined();
    expect(parsed.success).toBe(true);
  });

  test("join rows are flattened to the tag itself", () => {
    expect(toV3PipelineResponse(readbackRow()).tags).toEqual([
      expect.objectContaining({ id: "cltg000000000000000000001", name: "tag-a" }),
    ]);
  });

  test("the contact carries its userId from the snapshot taken at create time", () => {
    expect(toV3PipelineResponse(readbackRow()).contact).toEqual({
      id: "clct000000000000000000001",
      userId: "user-42",
    });
  });

  test("an anonymous response still parses", () => {
    const row = readbackRow({ contact: null, contactAttributes: null, tags: [] });

    expect(ZResponse.safeParse(toV3PipelineResponse(row)).success).toBe(true);
  });
});

describe("createScopedResponse — what actually reaches Prisma", () => {
  test("tags are written as join rows in the same transaction", async () => {
    const tx = runTx(txStub({ tag: { findMany: vi.fn().mockResolvedValue([{ id: "cltg1" }]) } }));

    const outcome = await createScopedResponse(createInput({ tagIds: ["cltg1"] }));

    expect(outcome).toEqual({ ok: true, responseId: "clrs1" });
    expect(tx.response.create.mock.calls[0][0].data.tags).toEqual({
      create: [{ tag: { connect: { id: "cltg1" } } }],
    });
  });

  test("no tags means no tags key at all, rather than an empty create", async () => {
    const tx = runTx(txStub());

    await createScopedResponse(createInput());

    expect(tx.response.create.mock.calls[0][0].data.tags).toBeUndefined();
  });

  /** The reference checks run inside the transaction, against the snapshot the write will use. */
  test("a contact outside the workspace stops the write before it happens", async () => {
    const tx = runTx(txStub({ contact: { findFirst: vi.fn().mockResolvedValue(null) } }));

    const outcome = await createScopedResponse(createInput({ contactId: "clct000000000000000000009" }));

    expect(outcome).toEqual({
      ok: false,
      issues: [expect.objectContaining({ name: "contactId", code: "invalid_reference" })],
    });
    expect(tx.response.create).not.toHaveBeenCalled();
  });

  test("a display already backing another response is refused", async () => {
    const tx = runTx(
      txStub({
        display: { findFirst: vi.fn().mockResolvedValue({ id: "cldp1", response: { id: "other" } }) },
      })
    );

    const outcome = await createScopedResponse(createInput({ displayId: "cldp1" }));

    expect(outcome.ok).toBe(false);
    expect(tx.response.create).not.toHaveBeenCalled();
  });

  test("a single-use id already used on this survey is refused", async () => {
    const tx = txStub();
    tx.response.findFirst.mockResolvedValueOnce({ id: "clrs-existing" });
    runTx(tx);

    const outcome = await createScopedResponse(createInput({ singleUseId: "su-1" }));

    expect(outcome).toEqual({
      ok: false,
      issues: [expect.objectContaining({ name: "singleUseId", code: "duplicate_identifier" })],
    });
  });

  test("every unresolvable tag id is reported, not just the first", async () => {
    runTx(txStub({ tag: { findMany: vi.fn().mockResolvedValue([{ id: "cltg1" }]) } }));

    const outcome = await createScopedResponse(createInput({ tagIds: ["cltg1", "cltg2", "cltg3"] }));

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.issues.map((i) => i.identifier)).toEqual(["cltg2", "cltg3"]);
  });

  /** Quotas resolve `reserved` operands off the persisted row, so they run after it exists. */
  test("quota evaluation gets the row as persisted, not the request body", async () => {
    const tx = txStub();
    tx.response.create.mockResolvedValueOnce({
      id: "clrs1",
      finished: true,
      data: { q1: "x" },
      variables: {},
    });
    runTx(tx);

    await createScopedResponse(createInput({ finished: false }));

    expect(mockEvaluateQuotas).toHaveBeenCalledWith(
      expect.objectContaining({ responseFinished: true, responseId: "clrs1" })
    );
  });
});

describe("updateScopedResponse — what actually reaches Prisma", () => {
  /** A bare id is how a caller reaches another tenant's response; the scope goes in the `where`. */
  test("the update is scoped by workspace, never by id alone", async () => {
    const tx = runTx(txStub());

    await updateScopedResponse({
      responseId: "clrs1",
      workspaceId: survey.workspaceId,
      survey,
      patch: { finished: true },
    });

    expect(tx.response.update.mock.calls[0][0].where).toEqual({
      id: "clrs1",
      survey: { workspaceId: survey.workspaceId },
    });
  });

  /**
   * Spreading an absent key as `undefined` is the difference between "leave it" and "null it" for a
   * nullable column, and `endingId` and `language` are both nullable.
   */
  test("a key the payload omits does not appear in the update at all", async () => {
    const tx = runTx(txStub());

    await updateScopedResponse({
      responseId: "clrs1",
      workspaceId: survey.workspaceId,
      survey,
      patch: { finished: true },
    });

    expect(Object.keys(tx.response.update.mock.calls[0][0].data)).toEqual(["finished"]);
  });

  test("an explicit null does reach the update", async () => {
    const tx = runTx(txStub());

    await updateScopedResponse({
      responseId: "clrs1",
      workspaceId: survey.workspaceId,
      survey,
      patch: { endingId: null },
    });

    expect(tx.response.update.mock.calls[0][0].data).toEqual({ endingId: null });
  });

  /** `tags` is the complete set, so the join rows are cleared and rewritten rather than added to. */
  test("patching tags replaces the set", async () => {
    const tx = runTx(txStub({ tag: { findMany: vi.fn().mockResolvedValue([{ id: "cltg1" }]) } }));

    await updateScopedResponse({
      responseId: "clrs1",
      workspaceId: survey.workspaceId,
      survey,
      patch: { tagIds: ["cltg1"] },
    });

    expect(tx.response.update.mock.calls[0][0].data.tags).toEqual({
      deleteMany: {},
      create: [{ tag: { connect: { id: "cltg1" } } }],
    });
  });

  /**
   * Not only on a patch that finishes the response: for a quota with `countPartialSubmissions: false`
   * the link row is written once the response is finished, so a create-only evaluation under-counts.
   */
  test("quotas are evaluated on every patch", async () => {
    runTx(txStub());

    await updateScopedResponse({
      responseId: "clrs1",
      workspaceId: survey.workspaceId,
      survey,
      patch: { data: { q1: "typo fixed" } },
    });

    expect(mockEvaluateQuotas).toHaveBeenCalledTimes(1);
  });
});

describe("scoped reads", () => {
  test("a survey read for a write carries its inlined embedded fields", async () => {
    mockSurveyFindUnique.mockResolvedValueOnce({ id: survey.id, workspaceId: survey.workspaceId });

    await expect(getSurveyForV3Write(survey.id)).resolves.toMatchObject({ embeddedFields: [] });
  });

  test("a survey that does not exist resolves to null rather than throwing", async () => {
    mockSurveyFindUnique.mockResolvedValueOnce(null);

    await expect(getSurveyForV3Write(survey.id)).resolves.toBeNull();
  });

  test("the read-back is scoped by workspace", async () => {
    mockResponseFindFirst.mockResolvedValueOnce(readbackRow());

    await readbackV3Response("clrs1", { workspaceId: survey.workspaceId });

    expect(mockResponseFindFirst.mock.calls[0][0].where).toEqual({
      id: "clrs1",
      survey: { workspaceId: survey.workspaceId },
    });
  });
});
