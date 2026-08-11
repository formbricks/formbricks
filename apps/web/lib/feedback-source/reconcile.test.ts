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

const { reconcileFeedbackRecords, UPDATE_FIELD_KEYS } = await import("./reconcile");
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

    expect(result).toEqual({ created: 2, reconciled: 0, superseded: 0, failures: [] });
    expect(mockListFeedbackRecords).not.toHaveBeenCalled();
    expect(mockUpdateFeedbackRecord).not.toHaveBeenCalled();
  });

  test("does nothing at all for an empty record set", async () => {
    const result = await reconcileFeedbackRecords([], TENANT_ID);

    expect(result).toEqual({ created: 0, reconciled: 0, superseded: 0, failures: [] });
    expect(mockCreateFeedbackRecordsBatch).not.toHaveBeenCalled();
  });

  // The defect this module exists to fix: a response ingested as a partial, then finished with a
  // changed answer, used to 409 and leave Hub holding the old value forever.
  test("updates an existing record instead of dropping the conflict", async () => {
    arrangeConflict();

    const result = await reconcileFeedbackRecords([record({ value_text: "red" })], TENANT_ID);

    expect(result).toEqual({ created: 0, reconciled: 1, superseded: 0, failures: [] });
    expect(mockUpdateFeedbackRecord).toHaveBeenCalledWith(
      "existing",
      expect.objectContaining({ value_text: "red" })
    );
  });

  /**
   * Pins toUpdateParams against UPDATE_FIELD_KEYS, which is itself checked against the SDK's
   * FeedbackRecordUpdateParams at compile time. Together: an SDK bump that adds an update-eligible
   * field breaks the build, and forgetting to actually send one breaks this test.
   */
  test("sends exactly the fields Hub's update request accepts", async () => {
    arrangeConflict();

    await reconcileFeedbackRecords([record()], TENANT_ID);

    // The identifying fields (source_*, field_*, submission_id, collected_at) are not part of that
    // request and must not be sent.
    const [, payload] = mockUpdateFeedbackRecord.mock.calls[0];
    expect(Object.keys(payload).sort()).toEqual(Object.keys(UPDATE_FIELD_KEYS).sort());
  });

  /**
   * value_text is nullable on create but not on update, and null would read as "clear the stored
   * answer" rather than "no answer to send". The coercion is a one-liner, so nothing else would go
   * red if it were dropped.
   */
  test("never sends a null value_text — null means leave unchanged, not erase", async () => {
    arrangeConflict();

    await reconcileFeedbackRecords([record({ value_text: null })], TENANT_ID);

    const [, payload] = mockUpdateFeedbackRecord.mock.calls[0];
    expect(payload.value_text).toBeUndefined();
    expect(payload).not.toHaveProperty("value_text", null);
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
    // Same ENG-1916 contract as the batch-create failure path below: handled, so not an error log.
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("a failed update is a failure, not a silent success", async () => {
    mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
    mockListFeedbackRecords.mockResolvedValue({ data: { data: [{ id: "existing" }] }, error: null });
    mockUpdateFeedbackRecord.mockResolvedValue({ data: null, error: { status: 500 } });

    const result = await reconcileFeedbackRecords([record()], TENANT_ID);

    expect(result.reconciled).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(logger.error).not.toHaveBeenCalled();
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

    /**
     * Tenant scoping alone is not enough: every conflicting record must be looked up as *itself*.
     * A mixup here (e.g. reconciling with records[0] for every conflict) keeps the tenant right
     * while patching one response's answer over another's — the same stale-data corruption this
     * module exists to fix, moved from across time to across records. Both records below share a
     * tenant, so only the per-record identity assertion can catch it.
     */
    test("each conflict is looked up as its own record, not just within the tenant", async () => {
      mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict(), conflict()] });
      mockListFeedbackRecords.mockResolvedValue({ data: { data: [{ id: "existing" }] }, error: null });
      mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "existing" }, error: null });

      const conflicting = [
        record({ submission_id: "response-a", field_id: "q1" }),
        record({ submission_id: "response-b", field_id: "q2" }),
      ];

      await reconcileFeedbackRecords(conflicting, TENANT_ID);

      // Order is not the contract; covering each record exactly once is.
      const lookedUp = mockListFeedbackRecords.mock.calls.map(([params]) => ({
        submission_id: params.submission_id,
        field_id: params.field_id,
      }));

      expect(lookedUp).toHaveLength(2);
      expect(lookedUp).toEqual(
        expect.arrayContaining([
          { submission_id: "response-a", field_id: "q1" },
          { submission_id: "response-b", field_id: "q2" },
        ])
      );
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

    /**
     * Hub just told us the row exists, so an empty read is much more often replication lag than a
     * boundary breach. Retrying once keeps a transient blip from being reported as an invariant
     * violation — and from failing a record that was fine.
     */
    test("an empty post-409 lookup is retried before being called an anomaly", async () => {
      mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
      mockListFeedbackRecords
        .mockResolvedValueOnce({ data: { data: [] }, error: null })
        .mockResolvedValueOnce({ data: { data: [{ id: "appeared-late" }] }, error: null });
      mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "appeared-late" }, error: null });

      const result = await reconcileFeedbackRecords([record()], TENANT_ID);

      expect(mockListFeedbackRecords).toHaveBeenCalledTimes(2);
      expect(result.reconciled).toBe(1);
      expect(result.failures).toEqual([]);
      expect(mockUpdateFeedbackRecord).toHaveBeenCalledWith("appeared-late", expect.any(Object));
      expect(logger.error).not.toHaveBeenCalled();
    });

    /**
     * ENG-1916 again: the anomaly is loud, but once per run. Logging inside the per-conflict loop is
     * how a single bad batch turned into N error lines.
     */
    test("many invisible conflicts produce one error line, not one per record", async () => {
      mockCreateFeedbackRecordsBatch.mockResolvedValue({
        results: [conflict(), conflict(), conflict()],
      });
      mockListFeedbackRecords.mockResolvedValue({ data: { data: [] }, error: null });

      const result = await reconcileFeedbackRecords(
        [record(), record({ field_id: "q2" }), record({ field_id: "q3" })],
        TENANT_ID
      );

      expect(result.failures).toHaveLength(3);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_ID, count: 3 }),
        expect.any(String)
      );
    });
  });

  /**
   * Two uncoordinated writers reach this module. A historical import can hold a page of responses
   * for minutes; if the live pipeline corrects a record in that window, re-applying the import's
   * older copy would revert it — the same stale-value defect ENG-2058 fixes, from the other side.
   */
  describe("recency guard", () => {
    const snapshotAt = new Date("2026-08-10T12:00:00.000Z");

    test("leaves a record alone when Hub was written after our data was read", async () => {
      mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
      mockListFeedbackRecords.mockResolvedValue({
        data: { data: [{ id: "existing", updated_at: "2026-08-10T12:05:00.000Z" }] },
        error: null,
      });

      const result = await reconcileFeedbackRecords([record()], TENANT_ID, { snapshotAt });

      expect(result).toEqual({ created: 0, reconciled: 0, superseded: 1, failures: [] });
      expect(mockUpdateFeedbackRecord).not.toHaveBeenCalled();
    });

    test("still corrects a record Hub has not touched since our data was read", async () => {
      mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
      mockListFeedbackRecords.mockResolvedValue({
        data: { data: [{ id: "existing", updated_at: "2026-08-10T11:55:00.000Z" }] },
        error: null,
      });
      mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "existing" }, error: null });

      const result = await reconcileFeedbackRecords([record()], TENANT_ID, { snapshotAt });

      expect(result.reconciled).toBe(1);
      expect(result.superseded).toBe(0);
      expect(mockUpdateFeedbackRecord).toHaveBeenCalled();
    });

    // The live pipeline passes no snapshot: it is always the freshest writer and must never defer.
    test("writes unconditionally when the caller gives no snapshot", async () => {
      mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
      mockListFeedbackRecords.mockResolvedValue({
        data: { data: [{ id: "existing", updated_at: "2099-01-01T00:00:00.000Z" }] },
        error: null,
      });
      mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "existing" }, error: null });

      const result = await reconcileFeedbackRecords([record()], TENANT_ID);

      expect(result.reconciled).toBe(1);
      expect(result.superseded).toBe(0);
    });

    // Hub records predating the field, or a malformed value, must not silently stop corrections.
    test("writes when Hub reports no usable updated_at", async () => {
      mockCreateFeedbackRecordsBatch.mockResolvedValue({ results: [conflict()] });
      mockListFeedbackRecords.mockResolvedValue({
        data: { data: [{ id: "existing", updated_at: "not-a-date" }] },
        error: null,
      });
      mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "existing" }, error: null });

      const result = await reconcileFeedbackRecords([record()], TENANT_ID, { snapshotAt });

      expect(result.reconciled).toBe(1);
    });
  });

  /**
   * A re-import is the case where nearly every record 409s, so this is the fan-out that matters:
   * unbounded, one batch could put IMPORT_BATCH_SIZE x mappings round trips in flight at once.
   */
  test("caps how many conflicts reconcile at once", async () => {
    const conflictCount = 25;
    mockCreateFeedbackRecordsBatch.mockResolvedValue({
      results: Array.from({ length: conflictCount }, conflict),
    });

    let inFlight = 0;
    let peakInFlight = 0;
    mockListFeedbackRecords.mockImplementation(async () => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return { data: { data: [{ id: "existing" }] }, error: null };
    });
    mockUpdateFeedbackRecord.mockResolvedValue({ data: { id: "existing" }, error: null });

    const result = await reconcileFeedbackRecords(
      Array.from({ length: conflictCount }, (_, i) => record({ field_id: `q${i}` })),
      TENANT_ID
    );

    expect(result.reconciled).toBe(conflictCount);
    expect(peakInFlight).toBeLessThanOrEqual(8);
    expect(peakInFlight).toBeGreaterThan(1);
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
