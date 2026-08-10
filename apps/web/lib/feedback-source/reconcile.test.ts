import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FeedbackRecordCreateParams } from "@/modules/hub/types";

vi.mock("server-only", () => ({}));

const mockCreateFeedbackRecordsBatch = vi.fn();
const mockListFeedbackRecords = vi.fn();
const mockUpdateFeedbackRecord = vi.fn();

vi.mock("@/modules/hub", () => ({
  createFeedbackRecordsBatch: (...args: unknown[]) => mockCreateFeedbackRecordsBatch(...args),
  listFeedbackRecords: (...args: unknown[]) => mockListFeedbackRecords(...args),
  updateFeedbackRecord: (...args: unknown[]) => mockUpdateFeedbackRecord(...args),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { reconcileFeedbackRecords } = await import("./reconcile");
const { logger } = await import("@formbricks/logger");

const TENANT_ID = "clxxxxxxxxxxxxxxxx004";
const OTHER_TENANT_ID = "clxxxxxxxxxxxxxxxx999";

const record = (overrides: Partial<FeedbackRecordCreateParams> = {}): FeedbackRecordCreateParams =>
  ({
    tenant_id: TENANT_ID,
    submission_id: "response-1",
    source_type: "formbricks",
    field_id: "q1",
    field_type: "text",
    value_text: "red",
    ...overrides,
  }) as FeedbackRecordCreateParams;

const conflict = () => ({ data: null, error: { status: 409, message: "conflict", detail: "" } });
const created = () => ({ data: { id: "new-record" }, error: null });
const hubDown = () => ({ data: null, error: { status: 500, message: "boom", detail: "" } });

/** Wire up a conflict that resolves to `existing-record` so a test can focus on the PATCH itself. */
const arrangeConflict = () => {
  mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
  mockListFeedbackRecords.mockResolvedValue({ data: { data: [{ id: "existing" }] }, error: null });
  mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "existing" }, error: null });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reconcileFeedbackRecords", () => {
  test("creates records that do not exist yet and touches nothing else", async () => {
    mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [created(), created()] });

    const result = await reconcileFeedbackRecords([record(), record({ field_id: "q2" })], TENANT_ID);

    expect(result).toEqual({ created: 2, reconciled: 0, failures: [] });
    expect(mockListFeedbackRecords).not.toHaveBeenCalled();
    expect(mockUpdateFeedbackRecord).not.toHaveBeenCalled();
  });

  test("does nothing at all for an empty record set", async () => {
    const result = await reconcileFeedbackRecords([], TENANT_ID);

    expect(result).toEqual({ created: 0, reconciled: 0, failures: [] });
    expect(mockCreateFeedbackRecordsBatch).not.toHaveBeenCalled();
  });

  // The defect this module exists to fix: a response ingested as a partial, then finished with a
  // changed answer, used to 409 and leave Hub holding the old value forever.
  test("updates an existing record instead of dropping the conflict", async () => {
    arrangeConflict();

    const result = await reconcileFeedbackRecords([record({ value_text: "red" })], TENANT_ID);

    expect(result).toEqual({ created: 0, reconciled: 1, failures: [] });
    expect(mockUpdateFeedbackRecord).toHaveBeenCalledWith(
      "existing",
      expect.objectContaining({ value_text: "red" })
    );
  });

  test("sends exactly the fields Hub's update request accepts", async () => {
    arrangeConflict();

    await reconcileFeedbackRecords([record()], TENANT_ID);

    // Mirrors the SDK's FeedbackRecordUpdateParams. The identifying fields (source_*, field_*,
    // submission_id, collected_at) are not part of that request and must not be sent.
    const [, payload] = mockUpdateFeedbackRecord.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual(
      [
        "language",
        "metadata",
        "user_id",
        "value_boolean",
        "value_date",
        "value_id",
        "value_number",
        "value_text",
      ].sort()
    );
  });

  /**
   * value_id is the charts' grouping key (ENG-1673). Omitting it from the PATCH left a corrected
   * single-select pointing at the old choice id while its text showed the new answer — the
   * correction landed everywhere except the place that reads it.
   */
  test("carries the changed choice id, not just its label", async () => {
    arrangeConflict();

    await reconcileFeedbackRecords(
      [record({ field_type: "categorical", value_text: "Red", value_id: "choice-red" })],
      TENANT_ID
    );

    expect(mockUpdateFeedbackRecord).toHaveBeenCalledWith(
      "existing",
      expect.objectContaining({ value_id: "choice-red", value_text: "Red" })
    );
  });

  test("a non-409 error is reported as a failure against its own record", async () => {
    mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [created(), hubDown()] });

    const result = await reconcileFeedbackRecords([record(), record({ field_id: "q2" })], TENANT_ID);

    expect(result.created).toBe(1);
    expect(result.failures).toEqual([{ index: 1, error: { status: 500, message: "boom", detail: "" } }]);
    expect(mockListFeedbackRecords).not.toHaveBeenCalled();
  });

  test("a failed lookup does not lead to an update", async () => {
    mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
    mockListFeedbackRecords.mockResolvedValue({ data: null, error: { status: 500 } });

    const result = await reconcileFeedbackRecords([record()], TENANT_ID);

    expect(result.reconciled).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(mockUpdateFeedbackRecord).not.toHaveBeenCalled();
  });

  test("a failed update is a failure, not a silent success", async () => {
    mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
    mockListFeedbackRecords.mockResolvedValue({ data: { data: [{ id: "existing" }] }, error: null });
    mockUpdateFeedbackRecord.mockResolvedValue({ data: null, error: { status: 500 } });

    const result = await reconcileFeedbackRecords([record()], TENANT_ID);

    expect(result.reconciled).toBe(0);
    expect(result.failures).toHaveLength(1);
  });

  /**
   * The log levels on this path are an operator-visible contract (ENG-1916): one warn per run from
   * the caller, per-record detail at debug, and never error for a handled Hub failure. Reconcile
   * therefore reports failures by returning them. Pinned because reinstating a logger.error here
   * would silently reintroduce the 2N+1 outage spam that change removed.
   */
  test("does not log a handled Hub failure — it returns it for the caller to report", async () => {
    mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [hubDown()] });

    const result = await reconcileFeedbackRecords([record()], TENANT_ID);

    expect(result.failures).toHaveLength(1);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  /**
   * ENG-2058 S1 — the security-critical one.
   *
   * Hub resolves the tenant *from the record id* on PATCH and performs no caller-side check, so any
   * id handed to it gets written. The only thing keeping this inside the right workspace is that
   * the id came from a tenant-scoped lookup. If that filter is ever dropped, Hub will not catch it;
   * this test is what catches it.
   */
  describe("tenant scoping", () => {
    test("every lookup is scoped to the source's own tenant", async () => {
      mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict(), conflict()] });
      mockListFeedbackRecords.mockResolvedValue({ data: { data: [{ id: "existing" }] }, error: null });
      mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "existing" }, error: null });

      await reconcileFeedbackRecords([record(), record({ field_id: "q2" })], TENANT_ID);

      expect(mockListFeedbackRecords).toHaveBeenCalledTimes(2);

      for (const [params] of mockListFeedbackRecords.mock.calls) {
        expect(params.tenant_id).toBe(TENANT_ID);
        expect(params.tenant_id).not.toBe(OTHER_TENANT_ID);
      }
    });

    test("the lookup narrows to the exact submission and field, not just the tenant", async () => {
      arrangeConflict();

      await reconcileFeedbackRecords([record({ submission_id: "response-7", field_id: "q9" })], TENANT_ID);

      expect(mockListFeedbackRecords).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: TENANT_ID, submission_id: "response-7", field_id: "q9" })
      );
    });

    test("no record is ever updated with an id that did not come from a lookup", async () => {
      mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
      mockListFeedbackRecords.mockResolvedValue({
        data: { data: [{ id: "id-from-lookup" }] },
        error: null,
      });
      mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "id-from-lookup" }, error: null });

      await reconcileFeedbackRecords([record()], TENANT_ID);

      for (const [id] of mockUpdateFeedbackRecord.mock.calls) {
        expect(id).toBe("id-from-lookup");
      }
    });

    // Hub claims the row exists but this tenant cannot see it. That is the boundary disagreeing
    // with Hub's uniqueness index, not an outage, so it is loud and it never guesses at an id.
    test("a conflict the tenant cannot see fails loudly rather than guessing", async () => {
      mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
      mockListFeedbackRecords.mockResolvedValue({ data: { data: [] }, error: null });

      const result = await reconcileFeedbackRecords([record()], TENANT_ID);

      expect(result.failures).toHaveLength(1);
      expect(mockUpdateFeedbackRecord).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // Respondent free text is PII. Neither the logs nor the returned failures may carry it.
  test("never exposes record contents", async () => {
    mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
    mockListFeedbackRecords.mockResolvedValue({ data: { data: [] }, error: null });

    const secret = "my secret answer";
    const result = await reconcileFeedbackRecords([record({ value_text: secret })], TENANT_ID);

    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
