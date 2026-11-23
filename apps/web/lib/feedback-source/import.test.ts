import { createInMemoryResponseFindMany } from "../response/__mocks__/response-find-many.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import { TSurvey } from "@formbricks/types/surveys/types";
import { type TResponseCursor, whereAfterResponseCursor } from "../response/pagination";
import { importHistoricalResponses } from "./import";

vi.mock("../response/service", () => ({
  getResponses: vi.fn(),
}));

vi.mock("@/modules/hub", () => ({
  createFeedbackRecordsBatch: vi.fn(),
}));
vi.mock("./reconcile", () => ({
  reconcileFeedbackRecords: vi.fn(),
}));

vi.mock("./transform", () => ({
  transformResponseToFeedbackRecords: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { getResponses } = vi.mocked(await import("../response/service"));
const { reconcileFeedbackRecords } = vi.mocked(await import("./reconcile"));
const { transformResponseToFeedbackRecords } = vi.mocked(await import("./transform"));
const { logger } = await import("@formbricks/logger");

const ENV_ID = "clxxxxxxxxxxxxxxxx001";
const FEEDBACK_SOURCE_ID = "clxxxxxxxxxxxxxxxx002";
const SURVEY_ID = "clxxxxxxxxxxxxxxxx003";
const NOW = new Date("2026-02-24T10:00:00.000Z");

const mockFeedbackSource: TFeedbackSourceWithMappings = {
  id: FEEDBACK_SOURCE_ID,
  createdAt: NOW,
  updatedAt: NOW,
  name: "Test FeedbackSource",
  type: "formbricks_survey",
  status: "active",
  importMode: "completedOnly",
  elementScope: "specific" as const,
  workspaceId: ENV_ID,
  feedbackDirectoryId: "clxxxxxxxxxxxxxxxx004",
  lastSyncAt: null,
  createdBy: null,
  creatorName: null,
  formbricksMappings: [
    {
      id: "mapping-1",
      createdAt: NOW,
      feedbackSourceId: FEEDBACK_SOURCE_ID,
      workspaceId: ENV_ID,
      surveyId: SURVEY_ID,
      elementId: "el-1",
      hubFieldType: "text",
      customFieldLabel: null,
    },
  ],
  fieldMappings: [],
};

const mockSurvey = { id: SURVEY_ID, blocks: [] } as unknown as TSurvey;

describe("importHistoricalResponses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws InvalidInputError for non-formbricks feedbackSource", async () => {
    const csvFeedbackSource = { ...mockFeedbackSource, type: "csv" as const };

    await expect(importHistoricalResponses(csvFeedbackSource, mockSurvey)).rejects.toThrow(InvalidInputError);
    expect(getResponses).not.toHaveBeenCalled();
  });

  test("returns zeros when there are no responses", async () => {
    getResponses.mockResolvedValue([]);

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(result).toEqual({ successes: 0, failures: 0, skipped: 0 });
  });

  test("counts successes and skipped correctly", async () => {
    const mockResponses = [{ id: "r1" }, { id: "r2" }, { id: "r3" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords
      .mockReturnValueOnce([{ field: "record1" }] as never)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ field: "record3" }] as never);

    reconcileFeedbackRecords.mockResolvedValue({ created: 2, reconciled: 0, superseded: 0, failures: [] });

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(result.successes).toBe(2);
    expect(result.failures).toBe(0);
    expect(result.skipped).toBe(1);
  });

  // Low quality responses have no Feedback Records (ENG-4026), whichever import mode asks for them.
  test.each(["completedOnly", "all"] as const)(
    "skips Low quality responses and publishes the rest (%s)",
    async (importMode) => {
      getResponses.mockResolvedValueOnce([
        { id: "r1", outcome: null },
        { id: "r2", outcome: "lowQuality" },
        { id: "r3", outcome: null },
      ] as never);
      transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);
      reconcileFeedbackRecords.mockResolvedValue({ created: 2, reconciled: 0, superseded: 0, failures: [] });

      const result = await importHistoricalResponses({ ...mockFeedbackSource, importMode }, mockSurvey);

      expect(transformResponseToFeedbackRecords.mock.calls.map(([response]) => response.id)).toEqual([
        "r1",
        "r3",
      ]);
      // Two responses, one mapping each: nothing "skipped" that was meant to publish.
      expect(result).toEqual({ successes: 2, failures: 0, skipped: 0 });
    }
  );

  test("pages on past a page of nothing but Low quality responses", async () => {
    const lowQualityPage = Array.from({ length: 50 }, (_, i) => ({ id: `l${i}`, outcome: "lowQuality" }));
    getResponses.mockResolvedValueOnce(lowQualityPage as never);
    getResponses.mockResolvedValueOnce([{ id: "r1", outcome: null }] as never);
    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);
    reconcileFeedbackRecords.mockResolvedValue({ created: 1, reconciled: 0, superseded: 0, failures: [] });

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(getResponses).toHaveBeenCalledTimes(2);
    expect(result.successes).toBe(1);
  });

  /**
   * An import can hold a page of responses for a long time, so it passes the moment it read them and
   * lets reconcile skip records the live pipeline has corrected since. Without this argument the
   * guard in reconcile is dead code and the import silently reverts newer answers.
   */
  test("tells reconcile when its data was read, so it cannot revert newer writes", async () => {
    getResponses.mockResolvedValueOnce([{ id: "r1" }] as never);
    getResponses.mockResolvedValueOnce([]);
    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);
    reconcileFeedbackRecords.mockResolvedValue({ created: 1, reconciled: 0, superseded: 0, failures: [] });

    const before = new Date();
    await importHistoricalResponses(mockFeedbackSource, mockSurvey);
    const after = new Date();

    const [, , options] = reconcileFeedbackRecords.mock.calls[0];
    const snapshotAt = options?.snapshotAt;
    expect(snapshotAt).toBeInstanceOf(Date);
    // Taken before the read, so it can never claim the data is fresher than it is.
    expect(snapshotAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(snapshotAt!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test("a record superseded by a newer write still counts as a success", async () => {
    getResponses.mockResolvedValueOnce([{ id: "r1" }] as never);
    getResponses.mockResolvedValueOnce([]);
    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);
    reconcileFeedbackRecords.mockResolvedValue({ created: 0, reconciled: 0, superseded: 1, failures: [] });

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    // Hub holds a newer value, so the record is correct — not a failure and not a skip.
    expect(result.successes).toBe(1);
    expect(result.failures).toBe(0);
  });

  test("counts failures from Hub API errors", async () => {
    const mockResponses = [{ id: "r1" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);

    reconcileFeedbackRecords.mockResolvedValue({
      created: 0,
      reconciled: 0,
      superseded: 0,
      failures: [{ index: 0, error: { status: 500 } }],
    });

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(result.successes).toBe(0);
    expect(result.failures).toBe(1);
  });

  // Behaviour change (ENG-2058): a record that already existed used to be counted as "skipped",
  // which is how silently keeping a stale value read as normal. Reconcile updates it instead, so it
  // is a success. `skipped` is now only ever about mapping.
  test("counts a reconciled record as a success, not a skip", async () => {
    const mockResponses = [{ id: "r1" }, { id: "r2" }, { id: "r3" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);

    reconcileFeedbackRecords.mockResolvedValue({
      created: 1,
      reconciled: 1,
      superseded: 0,
      failures: [{ index: 0, error: { status: 500 } }],
    });

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(result.successes).toBe(2);
    expect(result.failures).toBe(1);
    expect(result.skipped).toBe(0);
  });

  // `transformResponseToFeedbackRecords` filters on `m.surveyId === survey.id`, so counting every
  // mapping the source holds would report the *other* survey's mappings as records that were
  // expected and never arrived. No behavioural change while a source binds one survey; this pins it
  // for the multi-survey source the schema already permits.
  test("counts only this survey's mappings towards skipped", async () => {
    const twoSurveySource: TFeedbackSourceWithMappings = {
      ...mockFeedbackSource,
      formbricksMappings: [
        mockFeedbackSource.formbricksMappings[0],
        {
          ...mockFeedbackSource.formbricksMappings[0],
          id: "mapping-2",
          surveyId: "clxxxxxxxxxxxxxxxx009",
          elementId: "el-2",
        },
      ],
    };

    getResponses.mockResolvedValueOnce([{ id: "r1" }] as never);
    getResponses.mockResolvedValueOnce([]);
    transformResponseToFeedbackRecords.mockReturnValueOnce([{ field: "record1" }] as never);
    reconcileFeedbackRecords.mockResolvedValue({ created: 1, reconciled: 0, superseded: 0, failures: [] });

    const result = await importHistoricalResponses(twoSurveySource, mockSurvey);

    expect(result).toEqual({ successes: 1, failures: 0, skipped: 0 });
  });

  test("pages on from the last response of each full batch", async () => {
    const atSecond = (second: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, second));
    const batch1 = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, createdAt: atSecond(100 - i) }));
    const batch2 = [{ id: "r50", createdAt: atSecond(10) }];

    getResponses.mockResolvedValueOnce(batch1 as never);
    getResponses.mockResolvedValueOnce(batch2 as never);

    transformResponseToFeedbackRecords.mockReturnValue([{ field: "record" }] as never);
    reconcileFeedbackRecords.mockResolvedValue({ created: 1, reconciled: 0, superseded: 0, failures: [] });

    await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(getResponses.mock.calls).toEqual([
      [SURVEY_ID, 50, 0, { finished: true }, undefined],
      [SURVEY_ID, 50, 0, { finished: true }, { id: "r49", createdAt: atSecond(51) }],
    ]);
  });

  /**
   * The import pages through the survey's responses while respondents keep answering and admins keep
   * deleting. These run the import over an in-memory survey that pages with the real cursor
   * condition, and change it between pages (ENG-2374).
   */
  describe("while the survey changes under it", () => {
    type TRow = { id: string; createdAt: Date; outcome: null };

    const atMinute = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute, 0, 123));

    /** Serves `getResponses` from `rows`, read on every call, ordered and narrowed like the real one. */
    const serveResponsesFrom = (rows: TRow[]) => {
      const findMany = createInMemoryResponseFindMany(rows);
      getResponses.mockImplementation((async (
        _surveyId: string,
        limit?: number,
        offset?: number,
        _filterCriteria?: unknown,
        cursor?: TResponseCursor
      ) =>
        findMany({
          where: whereAfterResponseCursor({ surveyId: SURVEY_ID }, cursor),
          skip: offset,
          take: limit,
        })) as never);
    };

    /** Ids the import handed to the transform, in order; each is one response published to the Hub. */
    const importedIds = () => transformResponseToFeedbackRecords.mock.calls.map(([response]) => response.id);

    /** Runs `change` once, right after the import has published its first page. */
    const afterFirstPage = (change: () => void) => {
      let pages = 0;
      reconcileFeedbackRecords.mockImplementation(async (records) => {
        pages += 1;
        if (pages === 1) change();
        return { created: records.length, reconciled: 0, superseded: 0, failures: [] };
      });
    };

    /** 120 responses, one a minute, newest first: `resp-119` … `resp-000`. */
    const makeRows = (): TRow[] =>
      Array.from({ length: 120 }, (_, i) => ({
        id: `resp-${String(i).padStart(3, "0")}`,
        createdAt: atMinute(i),
        outcome: null,
      }));

    const newestFirst = (rows: TRow[]) =>
      [...rows]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
        .map((row) => row.id);

    beforeEach(() => {
      transformResponseToFeedbackRecords.mockImplementation((response) => [{ field: response.id }] as never);
    });

    test("a response deleted mid-import does not make the next page skip one", async () => {
      const rows = makeRows();
      const expected = newestFirst(rows);
      // A response the first page already published is deleted: every later row moves up one place.
      afterFirstPage(() =>
        rows.splice(
          rows.findIndex((row) => row.id === "resp-100"),
          1
        )
      );
      serveResponsesFrom(rows);

      const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

      expect(importedIds()).toEqual(expected);
      expect(result).toEqual({ successes: 120, failures: 0, skipped: 0 });
    });

    test("a response that arrives mid-import is not read, and no page is read twice", async () => {
      const rows = makeRows();
      const expected = newestFirst(rows);
      // The new response is the live pipeline's to send; the import covers what existed when it began.
      afterFirstPage(() => rows.push({ id: "resp-new", createdAt: atMinute(500), outcome: null }));
      serveResponsesFrom(rows);

      const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

      expect(importedIds()).toEqual(expected);
      expect(result).toEqual({ successes: 120, failures: 0, skipped: 0 });
    });

    test("imports every response once when the page boundary splits a timestamp tie", async () => {
      // Imported responses keep their original dates, so ids are not chronological; and the responses
      // at positions 45 to 54 share one createdAt, so the first page ends inside the tie and the next
      // one has to continue it by id.
      const rows: TRow[] = Array.from({ length: 110 }, (_, i) => ({
        id: `resp-${String((i * 37) % 110).padStart(3, "0")}`,
        createdAt: i >= 45 && i < 55 ? atMinute(150) : atMinute(200 - i),
        outcome: null,
      }));
      const expected = newestFirst(rows);
      expect(rows.filter((row) => row.createdAt.getTime() === atMinute(150).getTime())).toHaveLength(10);
      afterFirstPage(() =>
        rows.splice(
          rows.findIndex((row) => row.id === expected[10]),
          1
        )
      );
      serveResponsesFrom(rows);

      await importHistoricalResponses(mockFeedbackSource, mockSurvey);

      expect(importedIds()).toEqual(expected);
    });

    test("a response backdated behind the last page read is still imported, once", async () => {
      const rows = makeRows();
      // Created mid-import with an old date, as an imported response is: it sorts into a page the
      // import has not read yet, so the import reads it.
      const backdated: TRow = { id: "resp-030b", createdAt: atMinute(30), outcome: null };
      afterFirstPage(() => rows.push(backdated));
      serveResponsesFrom(rows);

      await importHistoricalResponses(mockFeedbackSource, mockSurvey);

      expect(importedIds()).toEqual(newestFirst([...makeRows(), backdated]));
    });
  });

  // The whole point of ENG-2058: the historical import used to pull every response, while the live
  // pipeline only ever ran on responseFinished. These two pin that they now agree.
  test("completedOnly asks the response service for finished responses only", async () => {
    getResponses.mockResolvedValueOnce([]);

    await importHistoricalResponses({ ...mockFeedbackSource, importMode: "completedOnly" }, mockSurvey);

    expect(getResponses).toHaveBeenCalledWith(SURVEY_ID, 50, 0, { finished: true }, undefined);
  });

  test("all leaves the response query unfiltered so partials are included", async () => {
    getResponses.mockResolvedValueOnce([]);

    await importHistoricalResponses({ ...mockFeedbackSource, importMode: "all" }, mockSurvey);

    expect(getResponses).toHaveBeenCalledWith(SURVEY_ID, 50, 0, undefined, undefined);
  });

  test("does not call Hub API when all responses are skipped", async () => {
    const mockResponses = [{ id: "r1" }, { id: "r2" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    transformResponseToFeedbackRecords.mockReturnValue([]);

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    expect(reconcileFeedbackRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ successes: 0, failures: 0, skipped: 2 });
  });

  test("contains a transform failure instead of aborting the whole import (ENG-1939)", async () => {
    const mockResponses = [{ id: "r1" }, { id: "r2" }];
    getResponses.mockResolvedValueOnce(mockResponses as never);
    getResponses.mockResolvedValueOnce([]);

    // First response throws (e.g. malformed choice element); the second is healthy.
    transformResponseToFeedbackRecords
      .mockImplementationOnce(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'some')");
      })
      .mockReturnValueOnce([{ field: "record2" }] as never);

    reconcileFeedbackRecords.mockResolvedValue({ created: 1, reconciled: 0, superseded: 0, failures: [] });

    const result = await importHistoricalResponses(mockFeedbackSource, mockSurvey);

    // The healthy response is still imported; the throwing one is contained and logged.
    expect(result.successes).toBe(1);
    expect(reconcileFeedbackRecords).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.error)).toHaveBeenCalledTimes(1);
  });
});
