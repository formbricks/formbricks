import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { MAX_INGESTED_VALUE_BYTES } from "@formbricks/types/embedded-data-ingest";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { type TIngestContractSurvey, applyIngestContractToResponseData } from "./ingest";

vi.mock("@formbricks/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const surveyId = "survey_123";

const ingestedField = ({
  storageKey,
  dataType = "string",
  locked = false,
}: {
  storageKey: string;
  dataType?: TEmbeddedDataType;
  locked?: boolean;
}): TLinkedEmbeddedField => ({
  field: { key: null, name: storageKey, source: "ingested", dataType, defaultValue: null, locked },
  link: { storageKey },
});

const survey = ({
  embeddedFields = [],
  elementIds = ["q1"],
  // A survey read through a select that omitted the Embedded Data join: no `embeddedFields` key.
  withoutJoin = false,
}: {
  embeddedFields?: TLinkedEmbeddedField[];
  elementIds?: string[];
  withoutJoin?: boolean;
} = {}): TIngestContractSurvey =>
  ({
    id: surveyId,
    blocks: [{ id: "block_1", elements: elementIds.map((id) => ({ id })) }],
    ...(withoutJoin ? {} : { embeddedFields }),
  }) as unknown as TIngestContractSurvey;

describe("applyIngestContractToResponseData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("keeps question answers and stores declared values under their declared keys", () => {
    const result = applyIngestContractToResponseData(
      survey({ embeddedFields: [ingestedField({ storageKey: "seats", dataType: "number" })] }),
      { q1: "answer", seats: "12" }
    );

    expect(result.data).toEqual({ q1: "answer", seats: 12 });
    expect(result.flags).toEqual([]);
  });

  test("takes its element ids from the survey's blocks, so an answer is never coerced", () => {
    const result = applyIngestContractToResponseData(survey({ elementIds: ["q1", "q2"] }), {
      q1: "42",
      q2: ["a", "b"],
    });

    expect(result.data).toEqual({ q1: "42", q2: ["a", "b"] });
  });

  test("treats an absent payload as nothing to ingest", () => {
    const result = applyIngestContractToResponseData(survey(), undefined);

    expect(result.data).toEqual({});
    expect(result.flags).toEqual([]);
    expect(result.dropped).toEqual([]);
  });

  /**
   * The fail-closed consequence of ENG-2412: the rows are the whole allow-list, so a survey select
   * that omitted the join is indistinguishable from a survey with no fields. Asserted rather than
   * assumed, because the four payload paths each have their own test pinning the join.
   */
  test("ingests nothing when the survey carries no rows", () => {
    const result = applyIngestContractToResponseData(survey(), { q1: "answer", plan: "gold" });

    expect(result.data).toEqual({ q1: "answer" });
    expect(result.dropped).toEqual([{ key: "plan", reason: "unknown_key" }]);
  });

  test("warns loudly when the survey was read without its Embedded Data rows", () => {
    // The fail-closed regression: a select that omitted the join. Through the generic drop line this
    // is indistinguishable from one typo'd param, so it gets its own level and message.
    applyIngestContractToResponseData(survey({ withoutJoin: true }), { q1: "answer", plan: "gold" });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyId,
        dropped: { entries: [{ key: "plan", reason: "unknown_key" }], omitted: 0 },
      }),
      expect.stringContaining("without its Embedded Data rows")
    );
  });

  test("does not raise the missing-join alarm when nothing was dropped, or when the join was read", () => {
    // Same broken read, but nobody sent a param for it — nothing was lost, so nothing to report.
    applyIngestContractToResponseData(survey({ withoutJoin: true }), { q1: "answer" });
    expect(logger.warn).not.toHaveBeenCalled();

    // A survey with no fields carries an empty list, not an absent one, and drops unknown keys all
    // the time; that must never look like the regression.
    applyIngestContractToResponseData(survey(), { rogue: "injected" });
    applyIngestContractToResponseData(survey({ embeddedFields: [ingestedField({ storageKey: "plan" })] }), {
      rogue: "injected",
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("logs what it dropped or flagged, and stays quiet on a clean payload", () => {
    applyIngestContractToResponseData(survey(), { q1: "answer" });
    expect(logger.info).not.toHaveBeenCalled();

    applyIngestContractToResponseData(survey(), { rogue: "injected" });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        surveyId,
        dropped: { entries: [{ key: "rogue", reason: "unknown_key" }], omitted: 0 },
      }),
      expect.any(String)
    );
  });

  test("caps the keys one log line carries, since they are attacker-controlled", () => {
    const incoming = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`rogue${i}`, "x"]));

    applyIngestContractToResponseData(survey(), incoming);

    const [logged] = vi.mocked(logger.info).mock.calls[0] as [
      { dropped: { entries: unknown[]; omitted: number } },
    ];
    expect(logged.dropped.entries).toHaveLength(20);
    expect(logged.dropped.omitted).toBe(5);
  });

  test("truncates an oversize value and reports the flag for persistence", () => {
    const result = applyIngestContractToResponseData(
      survey({ embeddedFields: [ingestedField({ storageKey: "note" })] }),
      { note: "a".repeat(MAX_INGESTED_VALUE_BYTES + 1) }
    );

    expect(result.data.note as string).toHaveLength(MAX_INGESTED_VALUE_BYTES);
    expect(result.flags).toEqual([{ key: "note", reason: "truncated" }]);
  });

  test("refuses a locked field's write", () => {
    const result = applyIngestContractToResponseData(
      survey({ embeddedFields: [ingestedField({ storageKey: "plan", locked: true })] }),
      { plan: "gold" }
    );

    expect(result.data).toEqual({});
    expect(result.dropped).toEqual([{ key: "plan", reason: "locked_field" }]);
  });
});
