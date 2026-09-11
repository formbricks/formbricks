import { describe, expect, test, vi } from "vitest";
import { encodeKeysetCursor } from "@/app/api/v3/lib/keyset-cursor";
import {
  RESPONSES_CURSOR_KIND,
  parseV3ResponsesCountQuery,
  parseV3ResponsesListQuery,
} from "./parse-v3-responses-list-query";

vi.mock("server-only", () => ({}));

/**
 * `vitestSetup.ts` mocks `createHash` globally to return the literal `"fake-hash"`, which would make
 * every filter set fingerprint identically and turn the cursor-binding tests below into tautologies.
 * Restored here for the same reason `keyset-cursor.test.ts` restores it.
 */
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const WORKSPACE = "clws1234567890123456789012";
const SURVEY = "clsv1234567890123456789012";
const RESPONSE = "clrs1234567890123456789012";

const listQuery = (query: string) => parseV3ResponsesListQuery(new URLSearchParams(query));
const countQuery = (query: string) => parseV3ResponsesCountQuery(new URLSearchParams(query));

const okList = (query: string) => {
  const result = listQuery(query);
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.invalid_params)}`);
  return result;
};

const namesOf = (result: ReturnType<typeof listQuery> | ReturnType<typeof countQuery>) =>
  result.ok ? [] : result.invalid_params.map((param) => param.name);

describe("defaults the contract publishes", () => {
  test("limit, sortBy and includeTotalCount default to the documented values", () => {
    const result = okList(`workspaceId=${WORKSPACE}`);

    expect(result.limit).toBe(20);
    expect(result.sortBy).toBe("-createdAt");
    expect(result.includeTotalCount).toBe(false);
    expect(result.cursor).toBeNull();
  });

  /** Opt-in, unlike the surveys list: a total is an extra query the caller has to ask for. */
  test("includeTotalCount is opt-in and only `true` enables it", () => {
    expect(okList(`workspaceId=${WORKSPACE}&includeTotalCount=true`).includeTotalCount).toBe(true);
    expect(okList(`workspaceId=${WORKSPACE}&includeTotalCount=false`).includeTotalCount).toBe(false);
  });

  test("count defaults to the capped precision", () => {
    const result = countQuery(`workspaceId=${WORKSPACE}`);

    expect(result.ok && result.precision).toBe("capped");
  });
});

describe("what is refused", () => {
  test("an unknown query parameter is named rather than ignored", () => {
    expect(namesOf(listQuery(`workspaceId=${WORKSPACE}&orderBy=createdAt`))).toEqual(["orderBy"]);
  });

  /**
   * Rejected, never clamped: `meta.limit` echoes what the server used, so silently substituting 250
   * would make that echo a lie.
   */
  test("a limit above the maximum is rejected, not reduced to it", () => {
    expect(namesOf(listQuery(`workspaceId=${WORKSPACE}&limit=251`))).toEqual(["limit"]);
    expect(okList(`workspaceId=${WORKSPACE}&limit=250`).limit).toBe(250);
  });

  test("workspaceId is required and must be a cuid2", () => {
    expect(namesOf(listQuery(""))).toEqual(["workspaceId"]);
    expect(namesOf(listQuery("workspaceId=not-a-cuid"))).toEqual(["workspaceId"]);
  });

  test("more than a hundred ids is refused", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `clrs${String(i).padStart(22, "0")}`).join(",");

    expect(namesOf(listQuery(`workspaceId=${WORKSPACE}&filter[id][in]=${ids}`))).toEqual(["filter[id][in]"]);
  });

  /**
   * The paging keys are meaningless on a count, and accepting them would let a caller believe the
   * number respected a limit or a cursor.
   */
  test.each(["limit=10", "cursor=abc", "sortBy=createdAt", "includeTotalCount=true"])(
    "count refuses the paging-only parameter %s",
    (param) => {
      expect(namesOf(countQuery(`workspaceId=${WORKSPACE}&${param}`))).toHaveLength(1);
    }
  );
});

describe("the anchor rule", () => {
  /**
   * `finished` and `language` are heap residuals — bounded only when the scan is anchored to one
   * survey or one contact. Unanchored, the honest outcome on a large workspace is a timeout, so the
   * contract refuses rather than serving one slowly.
   */
  test.each(["filter[finished][eq]=true", "filter[language][in]=de"])(
    "%s without surveyId or contactId is refused",
    (param) => {
      expect(namesOf(listQuery(`workspaceId=${WORKSPACE}&${param}`))).toHaveLength(1);
    }
  );

  test.each([`surveyId=${SURVEY}`, `contactId=${RESPONSE}`])("either anchor admits it: %s", (anchor) => {
    expect(okList(`workspaceId=${WORKSPACE}&${anchor}&filter[finished][eq]=true`).filter.finished).toBe(true);
  });

  test("both offenders are reported at once, not one after the other", () => {
    const names = namesOf(
      listQuery(`workspaceId=${WORKSPACE}&filter[finished][eq]=true&filter[language][in]=de`)
    );

    expect(names).toEqual(["filter[finished][eq]", "filter[language][in]"]);
  });
});

describe("date bounds", () => {
  test("sending both forms of one bound is refused rather than resolved by precedence", () => {
    const names = namesOf(
      listQuery(
        `workspaceId=${WORKSPACE}&filter[createdAt][gte]=2026-01-01T00:00:00Z&filter[createdAt][gt]=2026-01-02T00:00:00Z`
      )
    );

    expect(names).toEqual(["filter[createdAt][gt]"]);
  });

  test("a lower bound later than the upper bound is refused", () => {
    const names = namesOf(
      listQuery(
        `workspaceId=${WORKSPACE}&filter[createdAt][gte]=2026-02-01T00:00:00Z&filter[createdAt][lte]=2026-01-01T00:00:00Z`
      )
    );

    expect(names).toEqual(["filter[createdAt][gte]"]);
  });

  test("the lower-bound violation names the bound the caller actually sent", () => {
    const names = namesOf(
      listQuery(
        `workspaceId=${WORKSPACE}&filter[createdAt][gt]=2026-02-01T00:00:00Z&filter[createdAt][lt]=2026-01-01T00:00:00Z`
      )
    );

    expect(names).toEqual(["filter[createdAt][gt]"]);
  });

  test("an offset-bearing instant is accepted, not only Z", () => {
    const result = okList(`workspaceId=${WORKSPACE}&filter[createdAt][gte]=2026-01-01T00:00:00%2B01:00`);

    expect(result.filter.createdAtGte?.toISOString()).toBe("2025-12-31T23:00:00.000Z");
  });

  test("a bound that is not an instant is refused", () => {
    expect(namesOf(listQuery(`workspaceId=${WORKSPACE}&filter[createdAt][gte]=2026-01-01`))).toEqual([
      "filter[createdAt][gte]",
    ]);
  });
});

describe("multi-value filters", () => {
  test("repeated keys and comma-separated values both spell one filter", () => {
    const repeated = okList(
      `workspaceId=${WORKSPACE}&surveyId=${SURVEY}&filter[language][in]=de&filter[language][in]=en`
    );
    const commas = okList(`workspaceId=${WORKSPACE}&surveyId=${SURVEY}&filter[language][in]=de,en`);

    expect(repeated.filter.languages).toEqual(["de", "en"]);
    expect(commas.filter.languages).toEqual(["de", "en"]);
  });

  /** A survey language code, not a locale — the literal `default` is a real value. */
  test("`default` is a legitimate language code", () => {
    const result = okList(`workspaceId=${WORKSPACE}&surveyId=${SURVEY}&filter[language][in]=default`);

    expect(result.filter.languages).toEqual(["default"]);
  });
});

describe("every filter survives into the parsed filter", () => {
  /**
   * `toFilter` maps the bracket-spelled query keys onto the filter object by hand, so a field can
   * fall out of it while the suite stays green — the parse still succeeds, the filter is simply
   * absent and the endpoint quietly returns more rows than asked for.
   */
  test("all nine filters round-trip", () => {
    const result = okList(
      [
        `workspaceId=${WORKSPACE}`,
        `surveyId=${SURVEY}`,
        `contactId=${RESPONSE}`,
        "filter[createdAt][gte]=2026-01-01T00:00:00Z",
        "filter[createdAt][lte]=2026-12-01T00:00:00Z",
        "filter[finished][eq]=false",
        "filter[language][in]=de,en",
        `filter[id][in]=${RESPONSE}`,
      ].join("&")
    );

    expect(result.filter).toEqual({
      workspaceId: WORKSPACE,
      surveyId: SURVEY,
      contactId: RESPONSE,
      createdAtGte: new Date("2026-01-01T00:00:00Z"),
      createdAtGt: undefined,
      createdAtLte: new Date("2026-12-01T00:00:00Z"),
      createdAtLt: undefined,
      finished: false,
      languages: ["de", "en"],
      ids: [RESPONSE],
    });
  });

  /** The exclusive bounds are a separate pair and are just as easy to drop. */
  test("the exclusive bounds round-trip too", () => {
    const result = okList(
      `workspaceId=${WORKSPACE}&filter[createdAt][gt]=2026-01-01T00:00:00Z&filter[createdAt][lt]=2026-12-01T00:00:00Z`
    );

    expect(result.filter.createdAtGt).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(result.filter.createdAtLt).toEqual(new Date("2026-12-01T00:00:00Z"));
  });

  /**
   * `false` is the value the service's `!== undefined` check exists for — a truthiness test would
   * drop it and silently widen the result set to every response.
   */
  test("filter[finished][eq]=false is a filter, not an absence", () => {
    const result = okList(`workspaceId=${WORKSPACE}&surveyId=${SURVEY}&filter[finished][eq]=false`);

    expect(result.filter.finished).toBe(false);
  });
});

describe("the cursor's binding", () => {
  const cursorFor = (fp: string, sortBy = "-createdAt") =>
    encodeKeysetCursor({
      version: 1,
      kind: RESPONSES_CURSOR_KIND,
      sortBy,
      fp,
      value: "2026-08-27T09:14:03.417Z",
      id: RESPONSE,
    });

  test("a cursor issued for this filter set is accepted", () => {
    const base = okList(`workspaceId=${WORKSPACE}`);
    const result = okList(`workspaceId=${WORKSPACE}&cursor=${cursorFor(base.fingerprint)}`);

    expect(result.cursor?.id).toBe(RESPONSE);
  });

  /** Changing a filter mid-walk must be a 400, not a silently truncated page. */
  test("a cursor issued for a different filter set is refused", () => {
    const base = okList(`workspaceId=${WORKSPACE}`);
    const names = namesOf(
      listQuery(`workspaceId=${WORKSPACE}&surveyId=${SURVEY}&cursor=${cursorFor(base.fingerprint)}`)
    );

    expect(names).toEqual(["cursor"]);
  });

  test("a cursor issued for a different sort order is refused", () => {
    const base = okList(`workspaceId=${WORKSPACE}`);
    const names = namesOf(
      listQuery(`workspaceId=${WORKSPACE}&sortBy=createdAt&cursor=${cursorFor(base.fingerprint)}`)
    );

    expect(names).toEqual(["cursor"]);
  });

  test("a malformed cursor is refused as `cursor`, not as a 500", () => {
    expect(namesOf(listQuery(`workspaceId=${WORKSPACE}&cursor=not-a-cursor`))).toEqual(["cursor"]);
  });

  /**
   * The page size is presentation, not identity: AIP-158 requires a changed `limit` to be honoured
   * mid-walk rather than invalidating the caller's position.
   */
  test("limit and includeTotalCount are outside the fingerprint", () => {
    const base = okList(`workspaceId=${WORKSPACE}`);
    const wider = okList(`workspaceId=${WORKSPACE}&limit=100&includeTotalCount=true`);

    expect(wider.fingerprint).toBe(base.fingerprint);
  });

  /** Order within an `[in]` is not a different filter set. */
  test("reordering a multi-value filter does not change the fingerprint", () => {
    const one = okList(`workspaceId=${WORKSPACE}&surveyId=${SURVEY}&filter[language][in]=de,en`);
    const two = okList(`workspaceId=${WORKSPACE}&surveyId=${SURVEY}&filter[language][in]=en,de`);

    expect(one.fingerprint).toBe(two.fingerprint);
  });

  /**
   * The binding's regression guard. Every field of `TV3ResponsesFilter` reaches the SQL, so every
   * one must reach the fingerprint — otherwise a cursor issued under that filter validates against a
   * request without it, and page two comes back correct-looking and wrong. One `surveyId` case
   * proved only that the mechanism exists; this proves the coverage.
   */
  /**
   * Each row varies exactly ONE field against its own baseline. `finished` and `language` need an
   * anchor, so theirs carries `surveyId` on both sides — putting it on the variant alone would make
   * the fingerprints differ because of `surveyId` and prove nothing about the field under test.
   */
  test.each([
    ["surveyId", "", `surveyId=${SURVEY}`],
    ["contactId", "", `contactId=${RESPONSE}`],
    ["createdAt gte", "", "filter[createdAt][gte]=2026-01-01T00:00:00Z"],
    ["createdAt gt", "", "filter[createdAt][gt]=2026-01-01T00:00:00Z"],
    ["createdAt lte", "", "filter[createdAt][lte]=2026-12-01T00:00:00Z"],
    ["createdAt lt", "", "filter[createdAt][lt]=2026-12-01T00:00:00Z"],
    ["finished", `surveyId=${SURVEY}`, `surveyId=${SURVEY}&filter[finished][eq]=true`],
    ["language", `surveyId=${SURVEY}`, `surveyId=${SURVEY}&filter[language][in]=de`],
    ["id", "", `filter[id][in]=${RESPONSE}`],
  ])("%s changes the fingerprint", (_label, baseline, variant) => {
    const base = okList(`workspaceId=${WORKSPACE}${baseline ? "&" + baseline : ""}`);
    const withFilter = okList(`workspaceId=${WORKSPACE}&${variant}`);

    expect(withFilter.fingerprint).not.toBe(base.fingerprint);
  });

  /** Two different values of one filter are two different filter sets, not merely "filtered". */
  test("two values of the same filter fingerprint differently", () => {
    const one = okList(`workspaceId=${WORKSPACE}&surveyId=${SURVEY}&filter[language][in]=de`);
    const two = okList(`workspaceId=${WORKSPACE}&surveyId=${SURVEY}&filter[language][in]=en`);

    expect(one.fingerprint).not.toBe(two.fingerprint);
  });

  test("the list and count fingerprints agree for the same filters", () => {
    const list = okList(`workspaceId=${WORKSPACE}&surveyId=${SURVEY}`);
    const count = countQuery(`workspaceId=${WORKSPACE}&surveyId=${SURVEY}`);

    expect(count.ok && count.filter).toEqual(list.filter);
  });
});
