import { describe, expect, test } from "vitest";
import { zCreateCreativeRequestBase } from "@formbricks/api-v3-schemas";
import { parseV3CreativesListQuery } from "./list-query";

const workspaceId = "clseedworkspace000000000";
const rowId = "clxx1234567890123456789012";
const at = new Date("2026-10-25T12:00:00.000Z");

const nameSchema = zCreateCreativeRequestBase.shape.name;
const MAX_NAME_LENGTH = nameSchema.maxLength ?? 0;

/** Mints the cursor for the page after a row named `name`, then sends it back as the next request would. */
const roundTrip = (name: string) => {
  const first = parseV3CreativesListQuery(new URLSearchParams({ workspaceId, sortBy: "name" }));
  if (!first.ok) throw new Error("the first page should parse");
  const cursor = first.query.nextCursor({ id: rowId, name, createdAt: at, updatedAt: at });
  return {
    cursor,
    next: parseV3CreativesListQuery(new URLSearchParams({ workspaceId, sortBy: "name", cursor })),
  };
};

describe("parseV3CreativesListQuery cursor", () => {
  // Both outgrew the old 1,024-character bound: about 1,150 characters for CJK, 2,170 for the control one.
  test.each([
    ["CJK, three bytes a character", "調"],
    ["a control character, six bytes once JSON-escaped (the worst case)", "\u001f"],
  ])("accepts the cursor it issues for a maximum-length name in %s", (_, character) => {
    const name = character.repeat(MAX_NAME_LENGTH);
    expect(nameSchema.safeParse(name).success).toBe(true);

    const { cursor, next } = roundTrip(name);

    expect(cursor.length).toBeGreaterThan(1024);
    expect(next).toMatchObject({ ok: true, query: { after: { value: name, id: rowId } } });
  });

  test("still refuses a token longer than any it issues", () => {
    const { cursor } = roundTrip("\u001f".repeat(MAX_NAME_LENGTH));
    const next = parseV3CreativesListQuery(
      new URLSearchParams({ workspaceId, sortBy: "name", cursor: `${cursor}${"A".repeat(4096)}` })
    );

    expect(next).toEqual({
      ok: false,
      invalidParams: [{ name: "cursor", reason: "The cursor is invalid." }],
    });
  });
});
