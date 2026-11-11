import { describe, expect, test } from "vitest";
import { reviveTimestamps } from "./json-timestamps";

describe("reviveTimestamps", () => {
  test("turns createdAt and updatedAt back into Dates and keeps every other field", () => {
    const revived = reviveTimestamps({
      id: "clabc",
      name: "Signup",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-02-03T04:05:06.000Z",
    });

    expect(revived).toEqual({
      id: "clabc",
      name: "Signup",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      updatedAt: new Date("2026-02-03T04:05:06.000Z"),
    });
    expect(revived.createdAt).toBeInstanceOf(Date);
  });
});
