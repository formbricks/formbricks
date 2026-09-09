import { describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { InvalidInputError } from "@formbricks/types/errors";
import {
  buildKeysetPage,
  computeFilterFingerprint,
  decodeKeysetCursor,
  encodeKeysetCursor,
  keysetOrderBy,
  keysetPagePredicate,
} from "./keyset-cursor";

vi.mock("server-only", () => ({}));

/**
 * `vitestSetup.ts` mocks `createHash` globally to return the literal `"fake-hash"`, for the license
 * check. That makes every fingerprint identical, which would turn the binding tests below into
 * tautologies — they would pass whatever the implementation did. Restore the real implementation here.
 */
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const FP = computeFilterFingerprint({ workspaceId: "ws_1" });
const EXPECTED = { kind: "responses.list", sortBy: "-createdAt", fp: FP };

const cursor = (over: Partial<Parameters<typeof encodeKeysetCursor>[0]> = {}) =>
  encodeKeysetCursor({
    version: 1,
    kind: "responses.list",
    sortBy: "-createdAt",
    fp: FP,
    value: "2026-08-27T09:14:03.417Z",
    id: "clrsaaaaaaaaaaaaaaaaaaaa",
    ...over,
  });

describe("encode/decode round trip", () => {
  test("a cursor it issued decodes back to the same position", () => {
    const decoded = decodeKeysetCursor(cursor(), EXPECTED);

    expect(decoded.value).toBe("2026-08-27T09:14:03.417Z");
    expect(decoded.id).toBe("clrsaaaaaaaaaaaaaaaaaaaa");
  });
});

describe("decodeKeysetCursor rejects", () => {
  const rejects = (raw: string, expected = EXPECTED) => {
    expect(() => decodeKeysetCursor(raw, expected)).toThrow(InvalidInputError);
  };

  /**
   * Padded with a base64url-safe run so the token stays *decodable* — the point is to isolate the
   * length guard. A token of raw junk would be rejected by the JSON parse regardless, which is why the
   * earlier version of this test stayed green with the guard deleted.
   */
  test("a token over the cap, even though it would otherwise decode", () => {
    const padded = encodeKeysetCursor({
      version: 1,
      kind: "responses.list",
      sortBy: "-createdAt",
      fp: FP,
      value: "2026-08-27T09:14:03.417Z",
      id: "clrsaaaaaaaaaaaaaaaaaaaa",
    });
    // Prove the premise: at its natural length this exact token is accepted.
    expect(() => decodeKeysetCursor(padded, EXPECTED)).not.toThrow();
    expect(padded.length).toBeLessThanOrEqual(512);

    const oversized = encodeKeysetCursor({
      version: 1,
      kind: `responses.list${"x".repeat(600)}`,
      sortBy: "-createdAt",
      fp: FP,
      value: "2026-08-27T09:14:03.417Z",
      id: "clrsaaaaaaaaaaaaaaaaaaaa",
    });
    expect(oversized.length).toBeGreaterThan(512);
    rejects(oversized);
  });

  test("garbage, and anything that is not the expected shape", () => {
    rejects("not-base64!!");
    rejects(Buffer.from('{"version":1}', "utf8").toString("base64url"));
  });

  /**
   * `Buffer.from(…, "base64url")` drops characters it does not recognise rather than throwing, so
   * without the canonical round-trip these are all accepted as the same position — one logical page
   * with many token spellings. Both shipped cursor implementations in this repo have that hole.
   */
  test.each([
    ["a prefix of dropped characters", (c: string) => `!!${c}`],
    ["padding", (c: string) => `${c}=`],
    ["a trailing newline", (c: string) => `${c}\n`],
  ])("%s — a non-canonical spelling of a valid token", (_label, mangle) => {
    const valid = cursor();
    // Guard the premise: these really do decode to the same bytes.
    expect(Buffer.from(mangle(valid), "base64url").toString("utf8")).toBe(
      Buffer.from(valid, "base64url").toString("utf8")
    );

    rejects(mangle(valid));
  });

  test("a payload whose keys are reordered, even though the JSON is equivalent", () => {
    const reordered = Buffer.from(
      JSON.stringify({
        kind: "responses.list",
        version: 1,
        sortBy: "-createdAt",
        fp: FP,
        id: "clrsaaaaaaaaaaaaaaaaaaaa",
        value: "2026-08-27T09:14:03.417Z",
      }),
      "utf8"
    ).toString("base64url");

    rejects(reordered);
  });

  test("an unknown field, so a cursor cannot smuggle extra state", () => {
    const extra = Buffer.from(
      JSON.stringify({
        version: 1,
        kind: "responses.list",
        sortBy: "-createdAt",
        fp: FP,
        value: "2026-08-27T09:14:03.417Z",
        id: "clrsaaaaaaaaaaaaaaaaaaaa",
        limit: 9999,
      }),
      "utf8"
    ).toString("base64url");

    rejects(extra);
  });

  /** A cursor minted for another collection must not validate here. */
  test("a cursor from a different collection", () => {
    rejects(cursor({ kind: "workflows.list" }));
  });

  test("a cursor issued for another sort order", () => {
    expect(() => decodeKeysetCursor(cursor({ sortBy: "createdAt" }), EXPECTED)).toThrow(
      "does not match the requested sort order"
    );
  });

  /**
   * The binding both existing implementations lack. Without it, changing a filter mid-walk returns a
   * silently truncated 200 the caller cannot detect.
   */
  test("a cursor issued for a different filter set", () => {
    const other = computeFilterFingerprint({ workspaceId: "ws_1", surveyId: "svy_2" });

    expect(() => decodeKeysetCursor(cursor(), { ...EXPECTED, fp: other })).toThrow(
      "issued for a different filter set"
    );
  });

  test("an id that is not a cuid2, before it becomes a comparison operand", () => {
    rejects(cursor({ id: "../../etc/passwd" }));
  });

  test("a timestamp carrying an offset rather than Z, which would be a second spelling", () => {
    rejects(cursor({ value: "2026-08-27T10:14:03.417+01:00" }));
  });

  test("a version it did not issue", () => {
    rejects(cursor({ version: 2 as never }));
  });
});

describe("computeFilterFingerprint", () => {
  test("is stable across key order and array order", () => {
    const a = computeFilterFingerprint({ workspaceId: "ws_1", language: ["de", "en"] });
    const b = computeFilterFingerprint({ language: ["en", "de"], workspaceId: "ws_1" });

    expect(a).toBe(b);
  });

  test("changes when a filter is added, removed or altered", () => {
    const base = computeFilterFingerprint({ workspaceId: "ws_1" });

    expect(computeFilterFingerprint({ workspaceId: "ws_2" })).not.toBe(base);
    expect(computeFilterFingerprint({ workspaceId: "ws_1", finished: true })).not.toBe(base);
  });

  test("ignores absent filters, so omitting one is the same as never sending it", () => {
    expect(computeFilterFingerprint({ workspaceId: "ws_1", surveyId: undefined })).toBe(
      computeFilterFingerprint({ workspaceId: "ws_1" })
    );
  });

  /**
   * Separators matter: without them `{a: "b", c: ""}` and `{a: "bc"}` would hash the same, and two
   * different filter sets would share a cursor.
   */
  /**
   * Two cases, because they fail for different reasons: the first needs the key/value separator, the
   * second needs the between-pairs separator. A single case survives deleting one of them.
   */
  test("does not collide across differently-split keys and values", () => {
    expect(computeFilterFingerprint({ a: "bc" })).not.toBe(computeFilterFingerprint({ ab: "c" }));
    expect(computeFilterFingerprint({ a: "b", c: "d" })).not.toBe(computeFilterFingerprint({ a: "bcd" }));
  });

  /**
   * `String(new Date())` is second-precision and embeds the local zone name, so these two instants
   * would fingerprint alike — and the same instant would differ across replicas in other timezones.
   */
  test("distinguishes Dates within the same second, and does not depend on the local timezone", () => {
    const a = computeFilterFingerprint({ createdAt: new Date("2026-01-01T00:00:00.400Z") });
    const b = computeFilterFingerprint({ createdAt: new Date("2026-01-01T00:00:00.900Z") });

    expect(a).not.toBe(b);
    expect(a).toBe(computeFilterFingerprint({ createdAt: new Date(1767225600400) }));
  });

  /** Better a loud failure at the callsite than a filter that silently stops being bound. */
  test("refuses a non-scalar value rather than collapsing it", () => {
    expect(() => computeFilterFingerprint({ createdAt: { gte: "2026-01-01" } })).toThrow(TypeError);
  });

  /**
   * A deny-list on `typeof value === "object"` misses functions, and `String(fn)` renders the
   * function's source text — a fingerprint over something that is not a filter value at all.
   */
  test("refuses a value that is not an object but is still not a scalar", () => {
    expect(() => computeFilterFingerprint({ surveyId: () => "x" })).toThrow(TypeError);
    expect(() => computeFilterFingerprint({ ids: ["a", null] })).toThrow(TypeError);
  });

  /**
   * The order has to be identical on every machine. `localeCompare` — what Sonar's S2871 suggests for
   * the bare `.sort()` this replaced — is locale-sensitive, so under `de-DE` versus `en-US` the same
   * filter set can canonicalize differently and a cursor minted on one replica 400s on another.
   */
  test("orders keys and array members by code unit, not by locale", () => {
    const a = computeFilterFingerprint({ ["a\u0308"]: 1, ["z"]: 2 });
    const b = computeFilterFingerprint({ ["z"]: 2, ["a\u0308"]: 1 });

    expect(a).toBe(b);
    expect(computeFilterFingerprint({ ids: ["B", "a"] })).toBe(computeFilterFingerprint({ ids: ["a", "B"] }));
  });
});

describe("buildKeysetPage", () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `clrs${i.toString().padStart(20, "0")}`.slice(0, 24),
      createdAt: new Date(Date.UTC(2026, 7, 27, 9, 14, i)),
    }));

  const build = (n: number, limit: number) =>
    buildKeysetPage({
      rows: rows(n),
      limit,
      kind: "responses.list",
      sortBy: "-createdAt",
      fp: FP,
      sortValue: (row) => row.createdAt,
    });

  test("trims the extra row and issues a cursor when there is more", () => {
    const { page, nextCursor } = build(21, 20);

    expect(page).toHaveLength(20);
    expect(nextCursor).not.toBeNull();
    // Both halves of the position, not just the id — a cursor carrying the right id and the wrong
    // timestamp walks from the wrong place, and asserting only the id cannot see that.
    expect(decodeKeysetCursor(nextCursor as string, EXPECTED)).toMatchObject({
      id: page[19].id,
      value: page[19].createdAt.toISOString(),
    });
  });

  /**
   * End-of-collection is decided by whether the peeked row existed, never by comparing the page length
   * to `limit` — a full-length final page must still end the walk.
   */
  test("ends the walk on a page that is exactly limit-length", () => {
    expect(build(20, 20).nextCursor).toBeNull();
  });

  test("ends the walk on a short page and on an empty one", () => {
    expect(build(5, 20).nextCursor).toBeNull();
    expect(build(0, 20)).toStrictEqual({ page: [], nextCursor: null });
  });
});

/**
 * The two SQL fragments had no tests at all, and four semantic mutations survived the suite: swapping
 * the comparison operator, swapping ASC/DESC, dropping the tie-breaker column from either. Asserting
 * on the built `Prisma.Sql` is cheap and catches all four; the real-database proof that the predicate
 * reaches the Index Cond lives in the smoke run recorded on the PR.
 */
describe("SQL fragments", () => {
  const sortColumn = Prisma.raw('"created_at"');
  const idColumn = Prisma.raw('"id"');
  const cursor = { value: "2026-08-27T09:14:03.417Z", id: "clrsaaaaaaaaaaaaaaaaaaaa" };

  test("descending pages backwards, with the tie-breaker in both the predicate and the order", () => {
    const predicate = keysetPagePredicate({ sortColumn, idColumn, direction: "desc", cursor });
    const order = keysetOrderBy({ sortColumn, idColumn, direction: "desc" });

    // A row constructor over both columns — not an OR expansion, which would not reach the Index Cond.
    // `.sql` renders placeholders as `?`; `.text` is the numbered form.
    expect(predicate.sql.replace(/\s+/g, " ")).toBe('("created_at", "id") < (?, ?)');
    expect(order.sql.replace(/\s+/g, " ")).toBe('ORDER BY "created_at" DESC, "id" DESC');
  });

  test("ascending flips both the comparison and the order together", () => {
    const predicate = keysetPagePredicate({ sortColumn, idColumn, direction: "asc", cursor });
    const order = keysetOrderBy({ sortColumn, idColumn, direction: "asc" });

    expect(predicate.sql.replace(/\s+/g, " ")).toBe('("created_at", "id") > (?, ?)');
    expect(order.sql.replace(/\s+/g, " ")).toBe('ORDER BY "created_at" ASC, "id" ASC');
  });

  /** The position must travel as bound parameters, never interpolated into the statement. */
  test("binds the cursor position rather than inlining it", () => {
    const predicate = keysetPagePredicate({ sortColumn, idColumn, direction: "desc", cursor });

    expect(predicate.values).toStrictEqual([new Date(cursor.value), cursor.id]);
    expect(predicate.sql).not.toContain(cursor.id);
  });
});
