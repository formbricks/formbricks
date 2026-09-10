import { describe, expect, test, vi } from "vitest";
import type { TEmbeddedValueResponse, TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { buildEmbeddedDataPlan, serializeEmbeddedData } from "./embedded-data";

vi.mock("server-only", () => ({}));

const declared = (
  name: string,
  source: "ingested" | "computed",
  dataType: string,
  over: Record<string, unknown> = {}
): TLinkedEmbeddedField =>
  ({
    field: { name, source, dataType, defaultValue: null, locked: false, ...over },
    link: { storageKey: source === "computed" ? "clvr000000000000000000001" : name },
  }) as unknown as TLinkedEmbeddedField;

const response = (over: Partial<TEmbeddedValueResponse> = {}): TEmbeddedValueResponse =>
  ({
    id: "clrs000000000000000000001",
    surveyId: "clsv000000000000000000001",
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-01T10:05:00.000Z"),
    finished: true,
    language: "en",
    data: {},
    variables: {},
    ttc: {},
    meta: {},
    ...over,
  }) as unknown as TEmbeddedValueResponse;

const project = (
  fields: TLinkedEmbeddedField[],
  res: TEmbeddedValueResponse,
  elementIds: string[] = []
) => serializeEmbeddedData(buildEmbeddedDataPlan(fields, elementIds), res).embeddedData;

const unresolvedOf = (fields: TLinkedEmbeddedField[], res: TEmbeddedValueResponse) =>
  serializeEmbeddedData(buildEmbeddedDataPlan(fields), res).unresolved;

const byKey = (entries: ReturnType<typeof project>, key: string) => entries.filter((e) => e.key === key);

describe("what is projected at all", () => {
  /**
   * The suppression this API adds. The catalog reads `ipAddress` like any other field and the
   * dashboard shows it, so nothing upstream does this for us — and the contract promises in two
   * places that v3 never exposes it.
   */
  test("ipAddress is never projected, even when captured", () => {
    const entries = project(
      [],
      response({ meta: { ipAddress: "203.0.113.9", url: "https://x.test/a" } as never })
    );

    expect(byKey(entries, "ipAddress")).toEqual([]);
  });

  /**
   * The `display: "none"` set is the response's own identity and timing, every one of which is
   * already a first-class field. Without this filter each would appear twice in one payload.
   */
  test.each(["responseId", "surveyId", "finished", "language", "durationSeconds", "startedAt", "finishedAt"])(
    "%s is not projected — it is a first-class field",
    (name) => {
      const entries = project([], response({ ttc: { _total: 5000 } as never }));

      expect(byKey(entries, name)).toEqual([]);
    }
  );

  test("an ordinary captured field is projected", () => {
    const entries = project([], response({ meta: { source: "link" } as never }));

    expect(byKey(entries, "source")[0]).toMatchObject({ kind: "reserved", type: "string", value: "link" });
  });

  /** The collection describes what the response holds, not what the survey declares. */
  test("a declared field with no value and no default is omitted rather than nulled", () => {
    const entries = project([declared("plan", "ingested", "string")], response());

    expect(byKey(entries, "plan")).toEqual([]);
  });

  test("a declared field falls back to its default", () => {
    const entries = project([declared("plan", "ingested", "string", { defaultValue: "free" })], response());

    expect(byKey(entries, "plan")[0]).toMatchObject({ value: "free" });
  });
});

describe("keys are names, not storage keys", () => {
  test("a hidden field is keyed by its name", () => {
    const entries = project([declared("plan", "ingested", "string")], response({ data: { plan: "gold" } }));

    expect(byKey(entries, "plan")[0]).toMatchObject({ kind: "ingested", value: "gold", label: "plan" });
  });

  /**
   * A variable is stored under its cuid. That is the storage layout, and publishing it would put an
   * internal id in the payload and make the read and write disagree on how to address one field.
   */
  test("a variable is keyed by its name, never by its cuid", () => {
    const entries = project(
      [declared("score", "computed", "number")],
      response({ variables: { clvr000000000000000000001: 7 } as never })
    );

    expect(byKey(entries, "score")[0]).toMatchObject({ kind: "computed", value: 7 });
    expect(entries.some((entry) => entry.key.startsWith("clvr"))).toBe(false);
  });
});

describe("a declared name colliding with a catalog name", () => {
  /**
   * Both are real values the response carries, and the response card shows both. Dropping one would
   * make v3 the only reader that silently picks a winner — so `key` is unique per `kind` rather than
   * across the collection, and `kind` is what separates them.
   */
  test("both entries appear, disambiguated by kind", () => {
    const entries = project(
      [declared("country", "ingested", "string")],
      response({ data: { country: "declared value" }, meta: { country: "PT" } as never })
    );
    const both = byKey(entries, "country");

    expect(both).toHaveLength(2);
    expect(both.map((e) => e.kind).sort()).toEqual(["ingested", "reserved"]);
    expect(both.find((e) => e.kind === "ingested")?.value).toBe("declared value");
    expect(both.find((e) => e.kind === "reserved")?.value).toBe("PT");
  });
});

describe("an element id claims the address", () => {
  /**
   * Ingest drops a declared ingested field whose storage key is an element id
   * (`element_id_collision`), so the value stored there is the respondent's answer. Projecting it
   * would republish an answer as caller-supplied context — and `PATCH embeddedData: { plan: null }`
   * would then read as clearing a field while actually deleting the answer.
   */
  test("a hidden field named after an element is not projected", () => {
    const entries = project(
      [declared("plan", "ingested", "string")],
      response({ data: { plan: "the respondent's answer" } }),
      ["plan"]
    );

    expect(byKey(entries, "plan")).toEqual([]);
  });

  /** Case-sensitive, matching the ingest contract: `Plan` addresses a slot no element claims. */
  test("a hidden field differing only by case is still projected", () => {
    const entries = project(
      [declared("Plan", "ingested", "string")],
      response({ data: { Plan: "gold" } }),
      ["plan"]
    );

    expect(byKey(entries, "Plan")[0]).toMatchObject({ kind: "ingested", value: "gold" });
  });

  /**
   * Only `ingested` fields are dropped by the contract. A variable's value lives in
   * `response.variables` under its cuid, so it shares no slot with an answer.
   */
  test("a variable whose name matches an element is still projected", () => {
    const entries = project(
      [declared("score", "computed", "number")],
      response({ variables: { clvr000000000000000000001: 7 } as never }),
      ["score"]
    );

    expect(byKey(entries, "score")[0]).toMatchObject({ kind: "computed", value: 7 });
  });
});

describe("value fidelity", () => {
  /**
   * `projectReservedValues` returns `Record<string, string | number>` — it stringifies booleans —
   * which is one of the two reasons this module resolves entries itself. The contract's `type` has
   * to stay honest.
   */
  test("a numeric captured value keeps its type", () => {
    const entries = project([], response({ meta: { screenWidth: 1440 } as never }));

    expect(byKey(entries, "screenWidth")[0]).toMatchObject({ type: "number", value: 1440 });
  });

  /**
   * `redactQuery` is applied by the shipped projection, not by `resolveEmbeddedValue` — so resolving
   * an entry directly returns the raw url, single-use token and all.
   */
  test.each(["url", "pageReferrer"])("%s comes back with its query stripped", (name) => {
    const entries = project(
      [],
      response({ meta: { [name]: "https://app.test/s/abc?suToken=secret&utm_source=x" } as never })
    );

    const value = byKey(entries, name)[0]?.value as string;
    expect(value).not.toContain("suToken");
    expect(value).toContain("https://app.test/s/abc");
  });

  test("a keep-privacy field is returned verbatim", () => {
    const entries = project([], response({ meta: { pagePath: "/pricing?plan=gold" } as never }));

    expect(byKey(entries, "pagePath")[0]?.value).toBe("/pricing?plan=gold");
  });
});

describe("a value the resolver cannot read is reported, not dropped", () => {
  /**
   * A legacy row can hold an array or object under a declared field's key. The resolver coerces
   * nothing and returns `undefined`, and `data` no longer carries these keys on the wire — so
   * without this the bytes would appear nowhere at all.
   */
  test.each([
    ["an array", ["a", "b"]],
    ["an object", { nested: "value" }],
  ])("%s under a declared hidden field surfaces in unresolved", (_label, stored) => {
    const fields = [declared("plan", "ingested", "string")];
    const res = response({ data: { plan: stored } as never });

    expect(byKey(project(fields, res), "plan")).toEqual([]);
    expect(unresolvedOf(fields, res)).toEqual([
      { key: "plan", rawValue: stored, reason: "valueShapeMismatch" },
    ]);
  });

  test("a field that is simply absent is not reported as a mismatch", () => {
    expect(unresolvedOf([declared("plan", "ingested", "string")], response())).toEqual([]);
  });

  /** A locked field ignores the response by design, so its stored value is not a mismatch. */
  test("a locked field is left alone", () => {
    const fields = [declared("plan", "ingested", "string", { locked: true, defaultValue: "free" })];

    expect(unresolvedOf(fields, response({ data: { plan: ["ignored"] } as never }))).toEqual([]);
  });
});
