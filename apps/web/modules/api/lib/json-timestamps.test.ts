import { describe, expect, test } from "vitest";
import { reviveDates, reviveTimestamps } from "./json-timestamps";

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

describe("reviveDates", () => {
  const ISO = "2026-01-02T03:04:05.000Z";
  const shape = {
    createdAt: true,
    items: [{ at: true }],
    nested: { at: true },
  } as const;

  test("revives the dates the shape names, at every depth and in every array element", () => {
    const revived = reviveDates(
      { createdAt: ISO, items: [{ at: ISO, label: ISO }, { at: ISO }], nested: { at: ISO }, note: ISO },
      shape
    );

    expect(revived).toEqual({
      createdAt: new Date(ISO),
      items: [{ at: new Date(ISO), label: ISO }, { at: new Date(ISO) }],
      nested: { at: new Date(ISO) },
      // A string elsewhere that looks like a date stays a string.
      note: ISO,
    });
  });

  test("takes an offset as well as Z, the way JSON.stringify and other clients write a date", () => {
    expect(reviveDates({ createdAt: "2026-01-02T05:04:05+02:00" }, shape)).toEqual({
      createdAt: new Date(ISO),
    });
  });

  test("leaves what is not a date where it expects one for the schema to refuse, and adds no keys", () => {
    const input = { createdAt: "yesterday", items: "none", nested: null };

    expect(reviveDates(input, shape)).toEqual(input);
    expect(reviveDates({}, shape)).toEqual({});
    expect(reviveDates("2026-01-02", true)).toBe("2026-01-02");
    expect(reviveDates(null, shape)).toBeNull();
  });

  test("copies what it changes and never mutates its input", () => {
    const input = { createdAt: ISO, nested: { at: ISO } };

    reviveDates(input, shape);

    expect(input).toEqual({ createdAt: ISO, nested: { at: ISO } });
  });
});
