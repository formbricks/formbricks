import { describe, expect, test, vi } from "vitest";
import { seedContractFeedbackRecords } from "./contract-feedback-records";

const DATASET_ID = "clctdataset0000000000001";

const createClient = (tablePresent: boolean) => {
  const queryRaw = vi.fn(() => Promise.resolve([{ present: tablePresent }]));
  const executeRaw = vi.fn(() => Promise.resolve(1));
  return { client: { $queryRaw: queryRaw, $executeRaw: executeRaw } as never, queryRaw, executeRaw };
};

/** The SQL text and bound values of one tagged-template call. */
const callOf = (call: unknown[]) => {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  return { sql: strings.join("?"), values };
};

describe("seedContractFeedbackRecords", () => {
  test("writes nothing and returns null when the Hub table is absent", async () => {
    const { client, queryRaw, executeRaw } = createClient(false);

    await expect(seedContractFeedbackRecords(client, DATASET_ID)).resolves.toBeNull();

    expect(callOf(queryRaw.mock.calls[0]).sql).toContain("to_regclass('public.feedback_records')");
    expect(executeRaw).not.toHaveBeenCalled();
  });

  test("upserts one NPS row per fixture score, scoped to the dataset as Cube's tenant", async () => {
    const { client, executeRaw } = createClient(true);
    // Spelled out rather than derived from CONTRACT_FEEDBACK_RECORDS, so emptying the fixture fails here
    // instead of passing with nothing for Cube to answer from.
    const expectedRows = [
      { sourceName: "Contract fixture — web", score: 10 },
      { sourceName: "Contract fixture — web", score: 9 },
      { sourceName: "Contract fixture — web", score: 6 },
      { sourceName: "Contract fixture — email", score: 8 },
      { sourceName: "Contract fixture — email", score: 3 },
      { sourceName: "Contract fixture — email", score: 10 },
    ];

    await expect(seedContractFeedbackRecords(client, DATASET_ID)).resolves.toBe(expectedRows.length);

    const calls = executeRaw.mock.calls.map(callOf);
    expect(calls).toHaveLength(expectedRows.length);
    for (const [index, { sql, values }] of calls.entries()) {
      const [tenantId, , sourceName, score] = values;
      expect(sql).toContain("INSERT INTO feedback_records");
      expect(sql).toContain("'nps'");
      expect(sql).toContain("ON CONFLICT (tenant_id, submission_id, field_id)");
      expect(tenantId).toBe(DATASET_ID);
      expect({ sourceName, score }).toEqual(expectedRows[index]);
    }
    // Distinct submission ids, so the conflict target never folds two fixture rows into one.
    expect(new Set(calls.map(({ values }) => values[1])).size).toBe(expectedRows.length);
  });

  test("dates every row inside the last seven days the spec's chart examples query", async () => {
    const { client, executeRaw } = createClient(true);

    await seedContractFeedbackRecords(client, DATASET_ID);

    for (const { sql, values } of executeRaw.mock.calls.map(callOf)) {
      expect(sql).toContain("now() - make_interval(hours => ?)");
      const hoursAgo = values[values.length - 1] as number;
      expect(hoursAgo).toBeGreaterThan(0);
      expect(hoursAgo).toBeLessThan(7 * 24);
    }
  });
});
