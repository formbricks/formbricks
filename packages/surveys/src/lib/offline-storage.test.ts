import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  type SurveyProgressEntry,
  addPendingResponse,
  clearPendingResponses,
  clearSurveyProgress,
  countPendingResponses,
  getPendingResponses,
  getSurveyProgress,
  patchSurveyProgressSnapshot,
  removePendingResponse,
  saveSurveyProgress,
} from "./offline-storage";

describe("offline-storage (IndexedDB)", () => {
  beforeEach(async () => {
    // Clear all data between tests by deleting the database
    // This also triggers onversionchange on any open connection, resetting the cached dbInstance
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("formbricks-offline");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  const makeSurveyStateSnapshot = (overrides = {}) => ({
    responseId: null,
    displayId: null,
    surveyId: "survey-1",
    singleUseId: null,
    userId: null,
    contactId: null,
    responseAcc: { finished: false, data: {}, ttc: {}, variables: {} },
    ...overrides,
  });

  const makeResponseUpdate = (data: Record<string, string> = { q1: "answer1" }, finished = false) => ({
    finished,
    data,
    ttc: {},
    variables: {},
  });

  describe("pendingResponses", () => {
    test("addPendingResponse and getPendingResponses round-trip", async () => {
      const id = await addPendingResponse({
        surveyId: "survey-1",
        responseUpdate: makeResponseUpdate(),
        surveyStateSnapshot: makeSurveyStateSnapshot(),
        createdAt: Date.now(),
      });

      expect(id).toBeGreaterThan(0);

      const results = await getPendingResponses("survey-1");
      expect(results).toHaveLength(1);
      expect(results[0].surveyId).toBe("survey-1");
      expect(results[0].responseUpdate.data).toEqual({ q1: "answer1" });
    });

    test("returns entries sorted by createdAt", async () => {
      await addPendingResponse({
        surveyId: "survey-1",
        responseUpdate: makeResponseUpdate({ q1: "second" }),
        surveyStateSnapshot: makeSurveyStateSnapshot(),
        createdAt: 2000,
      });

      await addPendingResponse({
        surveyId: "survey-1",
        responseUpdate: makeResponseUpdate({ q1: "first" }),
        surveyStateSnapshot: makeSurveyStateSnapshot(),
        createdAt: 1000,
      });

      const results = await getPendingResponses("survey-1");
      expect(results).toHaveLength(2);
      expect(results[0].responseUpdate.data.q1).toBe("first");
      expect(results[1].responseUpdate.data.q1).toBe("second");
    });

    test("getPendingResponses only returns entries for the given surveyId", async () => {
      await addPendingResponse({
        surveyId: "survey-1",
        responseUpdate: makeResponseUpdate({ q1: "s1" }),
        surveyStateSnapshot: makeSurveyStateSnapshot(),
        createdAt: Date.now(),
      });

      await addPendingResponse({
        surveyId: "survey-2",
        responseUpdate: makeResponseUpdate({ q1: "s2" }),
        surveyStateSnapshot: makeSurveyStateSnapshot({ surveyId: "survey-2" }),
        createdAt: Date.now(),
      });

      const results = await getPendingResponses("survey-1");
      expect(results).toHaveLength(1);
      expect(results[0].surveyId).toBe("survey-1");
    });

    test("removePendingResponse removes the correct entry", async () => {
      await addPendingResponse({
        surveyId: "survey-1",
        responseUpdate: makeResponseUpdate({ q1: "keep" }),
        surveyStateSnapshot: makeSurveyStateSnapshot(),
        createdAt: 1000,
      });

      const id2 = await addPendingResponse({
        surveyId: "survey-1",
        responseUpdate: makeResponseUpdate({ q1: "remove" }),
        surveyStateSnapshot: makeSurveyStateSnapshot(),
        createdAt: 2000,
      });

      await removePendingResponse(id2);

      const results = await getPendingResponses("survey-1");
      expect(results).toHaveLength(1);
      expect(results[0].responseUpdate.data.q1).toBe("keep");
    });

    test("countPendingResponses returns correct count", async () => {
      expect(await countPendingResponses("survey-1")).toBe(0);

      await addPendingResponse({
        surveyId: "survey-1",
        responseUpdate: makeResponseUpdate(),
        surveyStateSnapshot: makeSurveyStateSnapshot(),
        createdAt: Date.now(),
      });

      await addPendingResponse({
        surveyId: "survey-1",
        responseUpdate: makeResponseUpdate({ q2: "a2" }),
        surveyStateSnapshot: makeSurveyStateSnapshot(),
        createdAt: Date.now(),
      });

      await addPendingResponse({
        surveyId: "survey-other",
        responseUpdate: makeResponseUpdate(),
        surveyStateSnapshot: makeSurveyStateSnapshot({ surveyId: "survey-other" }),
        createdAt: Date.now(),
      });

      expect(await countPendingResponses("survey-1")).toBe(2);
      expect(await countPendingResponses("survey-other")).toBe(1);
      expect(await countPendingResponses("non-existent")).toBe(0);
    });

    test("clearPendingResponses removes all entries for a surveyId", async () => {
      await addPendingResponse({
        surveyId: "survey-1",
        responseUpdate: makeResponseUpdate(),
        surveyStateSnapshot: makeSurveyStateSnapshot(),
        createdAt: Date.now(),
      });

      await addPendingResponse({
        surveyId: "survey-1",
        responseUpdate: makeResponseUpdate({ q2: "answer2" }),
        surveyStateSnapshot: makeSurveyStateSnapshot(),
        createdAt: Date.now(),
      });

      await addPendingResponse({
        surveyId: "survey-other",
        responseUpdate: makeResponseUpdate({ q3: "other" }),
        surveyStateSnapshot: makeSurveyStateSnapshot({ surveyId: "survey-other" }),
        createdAt: Date.now(),
      });

      await clearPendingResponses("survey-1");

      const s1Results = await getPendingResponses("survey-1");
      expect(s1Results).toHaveLength(0);

      const otherResults = await getPendingResponses("survey-other");
      expect(otherResults).toHaveLength(1);
    });
  });

  describe("surveyProgress", () => {
    const makeProgress = (overrides = {}): Omit<SurveyProgressEntry, "surveyId"> => ({
      blockId: "block-1",
      responseData: { q1: "answer" },
      ttc: { q1: 1500 },
      currentVariables: { var1: "val1" },
      history: ["start"],
      selectedLanguage: "en",
      surveyStateSnapshot: makeSurveyStateSnapshot(),
      updatedAt: Date.now(),
      ...overrides,
    });

    test("saveSurveyProgress and getSurveyProgress round-trip", async () => {
      await saveSurveyProgress({ surveyId: "survey-1", ...makeProgress() });

      const result = await getSurveyProgress("survey-1");
      expect(result).toBeDefined();
      expect(result?.blockId).toBe("block-1");
      expect(result?.responseData).toEqual({ q1: "answer" });
      expect(result?.history).toEqual(["start"]);
    });

    test("saveSurveyProgress overwrites previous entry for same surveyId", async () => {
      await saveSurveyProgress({ surveyId: "survey-1", ...makeProgress({ blockId: "block-1" }) });
      await saveSurveyProgress({ surveyId: "survey-1", ...makeProgress({ blockId: "block-2" }) });

      const result = await getSurveyProgress("survey-1");
      expect(result?.blockId).toBe("block-2");
    });

    test("patchSurveyProgressSnapshot updates only the saved snapshot anchors", async () => {
      await saveSurveyProgress({
        surveyId: "survey-1",
        ...makeProgress({
          surveyStateSnapshot: makeSurveyStateSnapshot({
            responseId: null,
            displayId: "display-1",
            responseAcc: { finished: false, data: { q1: "answer" }, ttc: { q1: 1500 }, variables: {} },
          }),
        }),
      });

      await patchSurveyProgressSnapshot("survey-1", { responseId: "response-1" });

      const result = await getSurveyProgress("survey-1");
      expect(result?.blockId).toBe("block-1");
      expect(result?.responseData).toEqual({ q1: "answer" });
      expect(result?.surveyStateSnapshot.responseId).toBe("response-1");
      expect(result?.surveyStateSnapshot.displayId).toBe("display-1");
    });

    test("patchSurveyProgressSnapshot is a no-op when survey progress does not exist", async () => {
      await expect(patchSurveyProgressSnapshot("missing-survey", { responseId: "response-1" })).resolves.toBe(
        undefined
      );
      expect(await getSurveyProgress("missing-survey")).toBeUndefined();
    });

    test("getSurveyProgress returns undefined for non-existent surveyId", async () => {
      const result = await getSurveyProgress("non-existent");
      expect(result).toBeUndefined();
    });

    test("clearSurveyProgress removes the entry", async () => {
      await saveSurveyProgress({ surveyId: "survey-1", ...makeProgress() });
      await clearSurveyProgress("survey-1");

      const result = await getSurveyProgress("survey-1");
      expect(result).toBeUndefined();
    });
  });
});

describe("offline-storage graceful degradation", () => {
  beforeEach(async () => {
    // Reset the cached dbInstance by deleting the database
    // (triggers onversionchange → close → dbInstance = null)
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("formbricks-offline");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  test("addPendingResponse returns -1 when IndexedDB is unavailable", async () => {
    const originalIndexedDB = globalThis.indexedDB;
    // @ts-expect-error -- intentionally removing indexedDB for test
    delete globalThis.indexedDB;

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const id = await addPendingResponse({
      surveyId: "survey-1",
      responseUpdate: { finished: false, data: {}, ttc: {}, variables: {} },
      surveyStateSnapshot: {
        responseId: null,
        displayId: null,
        surveyId: "survey-1",
        singleUseId: null,
        userId: null,
        contactId: null,
        responseAcc: { finished: false, data: {}, ttc: {}, variables: {} },
      },
      createdAt: Date.now(),
    });

    expect(id).toBe(-1);

    consoleSpy.mockRestore();
    globalThis.indexedDB = originalIndexedDB;
  });

  test("getPendingResponses returns empty array when IndexedDB is unavailable", async () => {
    const originalIndexedDB = globalThis.indexedDB;
    // @ts-expect-error -- intentionally removing indexedDB for test
    delete globalThis.indexedDB;

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const results = await getPendingResponses("survey-1");
    expect(results).toEqual([]);

    consoleSpy.mockRestore();
    globalThis.indexedDB = originalIndexedDB;
  });

  test("countPendingResponses returns 0 when IndexedDB is unavailable", async () => {
    const originalIndexedDB = globalThis.indexedDB;
    // @ts-expect-error -- intentionally removing indexedDB for test
    delete globalThis.indexedDB;

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const count = await countPendingResponses("survey-1");
    expect(count).toBe(0);

    consoleSpy.mockRestore();
    globalThis.indexedDB = originalIndexedDB;
  });

  test("getSurveyProgress returns undefined when IndexedDB is unavailable", async () => {
    const originalIndexedDB = globalThis.indexedDB;
    // @ts-expect-error -- intentionally removing indexedDB for test
    delete globalThis.indexedDB;

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await getSurveyProgress("survey-1");
    expect(result).toBeUndefined();

    consoleSpy.mockRestore();
    globalThis.indexedDB = originalIndexedDB;
  });
});
