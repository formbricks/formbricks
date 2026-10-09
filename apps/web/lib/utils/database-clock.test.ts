import { describe, expect, test, vi } from "vitest";
import { readDatabaseClock } from "./database-clock";

vi.mock("server-only", () => ({}));

describe("readDatabaseClock", () => {
  test("reads clock_timestamp() as UTC wall-clock time, the moment the statement runs", async () => {
    const now = new Date("2030-01-10T00:00:00.123Z");
    const client = { $queryRaw: vi.fn().mockResolvedValue([{ now }]) };

    await expect(readDatabaseClock(client as never)).resolves.toBe(now);

    const [strings] = client.$queryRaw.mock.calls[0] as [TemplateStringsArray];
    expect(strings.join("?")).toBe(`SELECT (clock_timestamp() AT TIME ZONE 'UTC') AS "now"`);
  });
});
