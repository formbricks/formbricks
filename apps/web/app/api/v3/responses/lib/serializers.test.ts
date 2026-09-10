import { describe, expect, test, vi } from "vitest";
import { createV3ResponseSerializer } from "./serializers";
import type { TV3ResponseRow, TV3ResponseSurveyRow } from "./service";

vi.mock("server-only", () => ({}));

const i18n = (value: string, extra: Record<string, string> = {}) => ({ default: value, ...extra });

const SURVEY_UPDATED = new Date("2026-09-01T08:00:00.000Z");
const CREATED = new Date("2026-09-02T10:00:00.000Z");
const UPDATED = new Date("2026-09-02T10:05:00.000Z");

const language = (code: string, isDefault = false) => ({
  default: isDefault,
  enabled: true,
  language: { code },
});

const declaredField = (name: string, source: "ingested" | "computed", storageKey = name) =>
  ({
    field: { name, source, dataType: "string", defaultValue: null, locked: false },
    link: { storageKey },
  }) as unknown as NonNullable<TV3ResponseSurveyRow["embeddedFields"]>[number];

const survey = (over: Partial<TV3ResponseSurveyRow> = {}): TV3ResponseSurveyRow =>
  ({
    id: "clsv000000000000000000001",
    name: "Onboarding",
    workspaceId: "clws000000000000000000001",
    updatedAt: SURVEY_UPDATED,
    blocks: [
      {
        id: "blk",
        name: "Block",
        elements: [
          { id: "q1", type: "openText", headline: i18n("How satisfied?", { de: "Wie zufrieden?" }) },
        ],
      },
    ],
    questions: [],
    languages: [language("en", true), language("de")],
    embeddedDataLinks: [],
    embeddedFields: [],
    ...over,
  }) as unknown as TV3ResponseSurveyRow;

const row = (over: Partial<TV3ResponseRow> = {}): TV3ResponseRow =>
  ({
    id: "clrs000000000000000000001",
    surveyId: "clsv000000000000000000001",
    createdAt: CREATED,
    updatedAt: UPDATED,
    finished: true,
    endingId: null,
    language: null,
    data: { q1: "good" },
    variables: {},
    ttc: {},
    meta: {},
    displayId: null,
    singleUseId: null,
    contact: null,
    tags: [],
    ...over,
  }) as unknown as TV3ResponseRow;

const listItem = (r = row(), s = survey()) => createV3ResponseSerializer().toListItem(r, s);

describe("the envelope", () => {
  test("carries the survey's denormalized name and workspace, not the response's", () => {
    const item = listItem();

    expect(item).toMatchObject({
      id: "clrs000000000000000000001",
      surveyId: "clsv000000000000000000001",
      surveyName: "Onboarding",
      workspaceId: "clws000000000000000000001",
      finished: true,
      endingId: null,
    });
  });

  /** Machine-facing timestamps are ISO-8601, never a `Date` and never localized. */
  test("timestamps serialize as ISO strings", () => {
    const item = listItem();

    expect(item.createdAt).toBe("2026-09-02T10:00:00.000Z");
    expect(item.updatedAt).toBe("2026-09-02T10:05:00.000Z");
  });

  test("tags flatten out of the join rows", () => {
    const item = listItem(row({ tags: [{ tag: { id: "t1", name: "vip" } }] as never }));

    expect(item.tags).toEqual([{ id: "t1", name: "vip" }]);
  });

  /**
   * `resolution.surveyUpdatedAt` is the survey's timestamp, not the response's — it says which
   * definition the labels were resolved against, so a client can tell a re-labelled read from a
   * changed response.
   */
  test("resolution reports the survey's timestamp and the response's language", () => {
    const item = listItem(row({ language: "de" }));

    expect(item.resolution).toEqual({
      labelPolicy: "currentSurveyDefinition",
      labelsLanguage: "de",
      surveyUpdatedAt: "2026-09-01T08:00:00.000Z",
    });
  });
});

describe("durationSeconds", () => {
  /**
   * `_total` is a bucket the server keeps alongside real element ids. Including it would double the
   * whole response, and reading it *instead* of summing would leave every partial response — where
   * it is never written — with no duration at all.
   */
  test("sums the per-element buckets and ignores `_total`", () => {
    const item = listItem(row({ ttc: { q1: 1500, q2: 2500, _total: 4000 } as never }));

    expect(item.durationSeconds).toBe(4);
  });

  test("is absent, not zero, when the submission carried no timing", () => {
    expect(listItem(row({ ttc: {} as never })).durationSeconds).toBeUndefined();
    expect("durationSeconds" in listItem(row({ ttc: {} as never }))).toBe(false);
  });

  /** A `_total`-only response is a finished one whose per-element timing was never recorded. */
  test("is absent when only `_total` was stored", () => {
    expect(listItem(row({ ttc: { _total: 9000 } as never })).durationSeconds).toBeUndefined();
  });

  /**
   * `ZResponseTtc` is deliberately unbounded so pre-clamp rows still parse, so a real row can hold
   * a negative. Each term takes the same clamp the per-answer value does, so one bad entry cannot
   * pull the total below the parts a client can see.
   */
  test("clamps each term, so a negative legacy entry cannot reduce the total", () => {
    const item = listItem(row({ ttc: { q1: 2000, q2: -5000 } as never }));

    expect(item.durationSeconds).toBe(2);
  });

  test("does not surface float drift from summing", () => {
    const item = listItem(row({ ttc: { a: 100, b: 200, c: 300 } as never }));

    expect(item.durationSeconds).toBe(0.6);
  });
});

describe("the detailed view", () => {
  test("adds the four fields the list omits, and returns `data` as stored", () => {
    const stored = { q1: "good", legacy: ["a", "b"] };
    const resource = createV3ResponseSerializer().toResource(
      row({ data: stored as never, displayId: "cldp1", singleUseId: "su1" }),
      survey()
    );

    expect(resource.data).toEqual(stored);
    expect(resource.displayId).toBe("cldp1");
    expect(resource.singleUseId).toBe("su1");
    expect(resource.contact).toBeNull();
  });

  /** `userId` is a contact attribute row, not a column, so it arrives as a filtered list. */
  test("contact carries the userId attribute when the response has one", () => {
    const resource = createV3ResponseSerializer().toResource(
      row({ contact: { id: "clct1", attributes: [{ value: "user-42" }] } as never }),
      survey()
    );

    expect(resource.contact).toEqual({ id: "clct1", userId: "user-42" });
  });

  test("a contact with no userId attribute reports null rather than omitting it", () => {
    const resource = createV3ResponseSerializer().toResource(
      row({ contact: { id: "clct1", attributes: [] } as never }),
      survey()
    );

    expect(resource.contact).toEqual({ id: "clct1", userId: null });
  });

  test("is the list item plus those fields, and nothing else differs", () => {
    const serializer = createV3ResponseSerializer();
    const r = row();
    const { contact, displayId, singleUseId, data, ...rest } = serializer.toResource(r, survey());

    expect(rest).toEqual(serializer.toListItem(r, survey()));
  });
});

describe("the per-survey plans are reused without leaking across languages", () => {
  /**
   * The reason the serializer is a factory. A page of 250 responses may span several surveys and
   * several languages; caching the answer plan by survey id alone would serve one response's labels
   * to another response collected in a different language.
   */
  test("two responses on one survey in different languages get their own labels", () => {
    const serializer = createV3ResponseSerializer();
    const s = survey();

    const german = serializer.toListItem(row({ language: "de" }), s);
    const english = serializer.toListItem(row({ language: "en" }), s);

    expect(german.answers[0]?.elementLabel).toBe("Wie zufrieden?");
    expect(english.answers[0]?.elementLabel).toBe("How satisfied?");
  });

  test("a second response in the same language serializes identically", () => {
    const serializer = createV3ResponseSerializer();
    const s = survey();

    expect(serializer.toListItem(row({ language: "de" }), s)).toEqual(
      serializer.toListItem(row({ language: "de" }), s)
    );
  });

  /** The response's default language resolves through `default`, not through its own code. */
  test("a response with no language uses the survey's default labels", () => {
    expect(listItem(row({ language: null })).answers[0]?.elementLabel).toBe("How satisfied?");
  });
});

describe("the two collections and what falls between them", () => {
  test("a hidden field is embedded data, never an answer", () => {
    const s = survey({ embeddedFields: [declaredField("plan", "ingested")] });
    const item = listItem(row({ data: { q1: "good", plan: "gold" } as never }), s);

    expect(item.answers.map((a) => a.elementId)).toEqual(["q1"]);
    expect(item.embeddedData.map((e) => e.key)).toEqual(["plan"]);
    expect(item.unresolved).toEqual([]);
  });

  /**
   * A variable is keyed by cuid in `response.variables`, so it can never appear in `data` and must
   * not be excluded from `answers[]` by name.
   */
  test("a variable is embedded data without suppressing an element of the same name", () => {
    const s = survey({ embeddedFields: [declaredField("q1", "computed", "clvr00000000000000000001")] });
    const item = listItem(
      row({ data: { q1: "good" } as never, variables: { clvr00000000000000000001: "7" } as never }),
      s
    );

    expect(item.answers.map((a) => a.elementId)).toEqual(["q1"]);
    expect(item.embeddedData.map((e) => e.kind)).toEqual(["computed"]);
  });

  /** Answers first, then Embedded Data — the order the two collections appear in the payload. */
  test("unresolved concatenates answers before embedded data", () => {
    const s = survey({ embeddedFields: [declaredField("plan", "ingested")] });
    const item = listItem(row({ data: { deleted_element: "x", plan: { nested: "y" } } as never }), s);

    expect(item.unresolved.map((u) => [u.key, u.reason])).toEqual([
      ["deleted_element", "elementNotInSurvey"],
      ["plan", "valueShapeMismatch"],
    ]);
  });
});
