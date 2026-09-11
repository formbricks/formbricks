import { describe, expect, test, vi } from "vitest";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { buildAnswerPlan } from "./answers";
import {
  normalizeV3Ttc,
  planAnswerDataWrite,
  planEmbeddedDataWrite,
  resolveV3WriteLanguage,
  validateV3EndingId,
} from "./write-plan";

vi.mock("server-only", () => ({}));

const i18n = (value: string) => ({ default: value });

const element = (id: string): TSurveyElement =>
  ({
    id,
    type: "openText",
    headline: i18n(id),
    required: false,
    inputType: "text",
  }) as unknown as TSurveyElement;

/** A real plan from a real flatten — the write predicate is the plan's, so faking it proves nothing. */
const planFor = (elementIds: string[], ingestedStorageKeys: string[] = []) =>
  buildAnswerPlan(
    [{ id: "blk", name: "Block", elements: elementIds.map(element) } as unknown as TSurveyBlock],
    "default",
    ingestedStorageKeys
  );

const declared = (
  name: string,
  source: "ingested" | "computed",
  over: { dataType?: string; locked?: boolean; storageKey?: string } = {}
): TLinkedEmbeddedField =>
  ({
    field: {
      name,
      source,
      dataType: over.dataType ?? "text",
      defaultValue: null,
      locked: over.locked ?? false,
    },
    link: { storageKey: over.storageKey ?? (source === "computed" ? "clvr000000000000000000001" : name) },
  }) as unknown as TLinkedEmbeddedField;

const planEmbedded = (
  fields: TLinkedEmbeddedField[],
  incoming: Record<string, string | number | boolean | null>,
  elementIds: string[] = []
) => planEmbeddedDataWrite({ embeddedFields: fields, elementIds: new Set(elementIds), incoming });

describe("planAnswerDataWrite — the write predicate is the read projection", () => {
  test("an element answer is written", () => {
    const { data, issues } = planAnswerDataWrite(planFor(["q1"]), { q1: "yes" }, undefined);

    expect(issues).toEqual([]);
    expect(data).toEqual({ q1: "yes" });
  });

  /**
   * The key that makes a read-edit-write round trip safe. `GET` withholds a hidden field's value, so
   * a caller sending back what it read carries no key for it — and a literal wholesale replace would
   * delete a value the caller never saw and could not have preserved.
   */
  test("a stored hidden-field value survives a wholesale data replace", () => {
    const plan = planFor(["q1"], ["plan"]);

    const { data } = planAnswerDataWrite(plan, { q1: "new" }, { q1: "old", plan: "enterprise" });

    expect(data).toEqual({ q1: "new", plan: "enterprise" });
  });

  test("a system key stamped by the runtime survives the same replace", () => {
    const { data } = planAnswerDataWrite(
      planFor(["q1"]),
      { q1: "new" },
      { q1: "old", verifiedEmail: "a@b.test" }
    );

    expect(data.verifiedEmail).toBe("a@b.test");
  });

  /** Replacement is still replacement for everything the caller *can* see. */
  test("an omitted answer is removed", () => {
    const { data } = planAnswerDataWrite(planFor(["q1", "q2"]), { q1: "kept" }, { q1: "old", q2: "dropped" });

    expect(data).toEqual({ q1: "kept" });
  });

  test("writing a hidden field through data is refused, and points at embeddedData", () => {
    const { issues } = planAnswerDataWrite(planFor(["q1"], ["plan"]), { plan: "free" }, undefined);

    expect(issues).toEqual([
      expect.objectContaining({ name: "plan", code: "unsupported_field", referenceType: "hiddenField" }),
    ]);
  });

  test("writing verifiedEmail is refused without claiming it is a hidden field", () => {
    const { issues } = planAnswerDataWrite(
      planFor(["q1"]),
      { verifiedEmail: "attacker@evil.test" },
      undefined
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ name: "verifiedEmail", code: "unsupported_field" });
    expect(issues[0].referenceType).toBeUndefined();
  });

  /**
   * An element id that also names a declared field: the answer owns the address, so this is the one
   * write that fits it. Refusing it would make the key unwritable by either route.
   */
  test("a key that is both an element id and a declared field name is accepted as an answer", () => {
    const { data, issues } = planAnswerDataWrite(
      planFor(["plan"], ["plan"]),
      { plan: "answered" },
      undefined
    );

    expect(issues).toEqual([]);
    expect(data).toEqual({ plan: "answered" });
  });

  /** A renamed or deleted element's value is still the caller's data, and the read hands it back. */
  test("an unknown key round-trips rather than being refused", () => {
    const { data, issues } = planAnswerDataWrite(planFor(["q1"]), { qOld: "legacy" }, undefined);

    expect(issues).toEqual([]);
    expect(data).toEqual({ qOld: "legacy" });
  });
});

describe("planEmbeddedDataWrite — names in, storage keys out", () => {
  test("a hidden field is resolved from its name to its storage key", () => {
    const fields = [declared("Plan", "ingested", { storageKey: "plan" })];

    expect(planEmbedded(fields, { Plan: "enterprise" }).dataWrites).toEqual({ plan: "enterprise" });
  });

  test("a variable is written to its cuid rather than into the answer map", () => {
    const fields = [declared("score", "computed", { dataType: "number", storageKey: "clvr0001" })];

    const plan = planEmbedded(fields, { score: 42 });

    expect(plan.variableWrites).toEqual({ clvr0001: 42 });
    expect(plan.dataWrites).toEqual({});
  });

  /** Omission and `null` are the two halves of a merge; conflating them makes deletion unexpressible. */
  test("null clears and omission leaves alone", () => {
    const fields = [
      declared("plan", "ingested"),
      declared("tier", "ingested"),
      declared("score", "computed", { dataType: "number", storageKey: "clvr0001" }),
    ];

    const plan = planEmbedded(fields, { plan: null, score: null });

    expect(plan.dataClears).toEqual(["plan"]);
    expect(plan.variableClears).toEqual(["clvr0001"]);
    expect(plan.dataWrites).toEqual({});
    expect(plan.issues).toEqual([]);
  });

  test("a locked field ignores both a write and a clear", () => {
    const fields = [declared("plan", "ingested", { locked: true })];

    const written = planEmbedded(fields, { plan: "free" });
    const cleared = planEmbedded(fields, { plan: null });

    expect(written.dataWrites).toEqual({});
    expect(written.issues).toEqual([]);
    expect(cleared.dataClears).toEqual([]);
    expect(cleared.issues).toEqual([]);
  });

  test("an undeclared name is refused rather than silently dropped", () => {
    const { issues } = planEmbedded([declared("plan", "ingested")], { nope: "x" });

    expect(issues).toEqual([expect.objectContaining({ name: "nope", code: "unsupported_field" })]);
  });

  test("a reserved catalog name says where the three writable ones live", () => {
    const { issues } = planEmbedded([], { country: "PT" });

    expect(issues[0].reason).toContain("meta");
    expect(issues[0].reason).toContain("not writable");
  });

  /**
   * Two fields under one name cannot say which one to write, and guessing puts the caller's value in
   * the wrong field — silently, and only visible much later.
   */
  test("an ambiguous name is refused instead of guessed", () => {
    const fields = [declared("plan", "ingested"), declared("plan", "computed", { storageKey: "clvr0001" })];

    const plan = planEmbedded(fields, { plan: "x" });

    expect(plan.issues).toEqual([expect.objectContaining({ name: "plan", code: "duplicate_identifier" })]);
    expect(plan.dataWrites).toEqual({});
    expect(plan.variableWrites).toEqual({});
  });

  /**
   * The one that must never become a silent write: the ingest contract's own pass-through would
   * store this as the question's answer if the key reached it.
   */
  test("a field whose storage key is an element id cannot be written, and never lands on the answer", () => {
    const fields = [declared("plan", "ingested", { storageKey: "q1" })];

    const plan = planEmbedded(fields, { plan: "overwritten" }, ["q1"]);

    expect(plan.dataWrites).toEqual({});
    expect(plan.issues).toEqual([
      expect.objectContaining({ name: "plan", code: "unsupported_field", referenceType: "hiddenField" }),
    ]);
  });

  test("a variable that cannot hold the value is refused rather than corrupting a quota operand", () => {
    const fields = [declared("score", "computed", { dataType: "number", storageKey: "clvr0001" })];

    const plan = planEmbedded(fields, { score: "not a number" });

    expect(plan.variableWrites).toEqual({});
    expect(plan.issues).toEqual([expect.objectContaining({ name: "score", referenceType: "variable" })]);
  });

  /** Hidden fields keep the SDK's lenient semantics: stored and flagged, never a 422. */
  test("a hidden field that fails coercion is still stored", () => {
    const fields = [declared("age", "ingested", { dataType: "number" })];

    const plan = planEmbedded(fields, { age: "not a number" });

    expect(plan.issues).toEqual([]);
    expect(plan.dataWrites.age).toBe("not a number");
  });
});

describe("resolveV3WriteLanguage", () => {
  const languages = [
    { default: true, enabled: true, language: { code: "en" } },
    { default: false, enabled: true, language: { code: "de" } },
    { default: false, enabled: false, language: { code: "fr" } },
  ];

  test.each([
    [null, null],
    [undefined, null],
    ["default", "default"],
  ])("%s resolves to %s", (input, expected) => {
    const resolved = resolveV3WriteLanguage(languages, input);
    expect(resolved).toEqual({ ok: true, code: expected });
  });

  /**
   * The defect this function exists for. `normalizeResponseLanguage` expands `de` to `de-DE`, which
   * no longer matches the survey's declared `de`, so the read falls back to the default and every
   * label on a German response comes back in English. Storing the survey's own code is what closes
   * that gap — validated value in, same value stored.
   */
  test("the survey's declared code is returned, not a canonicalized form of the caller's", () => {
    expect(resolveV3WriteLanguage(languages, "de")).toEqual({ ok: true, code: "de" });
  });

  test("a case variant still resolves to the survey's own casing", () => {
    expect(resolveV3WriteLanguage(languages, "DE")).toEqual({ ok: true, code: "de" });
  });

  /**
   * The realistic shape, and the one that caught a real divergence. A survey's language rows are
   * canonicalized when created, so a real survey declares `de-DE` while callers send `de`. v1 and v2
   * accept that because they canonicalize the caller's value; comparing raw strings made v3 answer
   * 422 for a payload the other two take. Matching is canonical; storing is still verbatim.
   */
  test("a bare code matches a survey that declares the canonical one, and stores the survey's", () => {
    const canonical = [
      { default: true, enabled: true, language: { code: "en-US" } },
      { default: false, enabled: true, language: { code: "de-DE" } },
    ];

    expect(resolveV3WriteLanguage(canonical, "de")).toEqual({ ok: true, code: "de-DE" });
    expect(resolveV3WriteLanguage(canonical, "de-DE")).toEqual({ ok: true, code: "de-DE" });
    expect(resolveV3WriteLanguage(canonical, "DE-de")).toEqual({ ok: true, code: "de-DE" });
  });

  /** And the reverse: a legacy survey declaring the bare code still takes a canonical payload. */
  test("a canonical code matches a survey that declares the bare one", () => {
    expect(resolveV3WriteLanguage(languages, "de-DE")).toEqual({ ok: true, code: "de" });
  });

  /** Canonical matching must not smuggle a language the survey never declared. */
  test("canonicalization does not widen the accepted set", () => {
    const canonical = [{ default: true, enabled: true, language: { code: "en-US" } }];

    expect(resolveV3WriteLanguage(canonical, "de").ok).toBe(false);
    expect(resolveV3WriteLanguage(canonical, "de-DE").ok).toBe(false);
  });

  test("a language the survey does not declare is refused", () => {
    const resolved = resolveV3WriteLanguage(languages, "es");
    expect(resolved.ok).toBe(false);
    expect(resolved.ok === false && resolved.issue).toMatchObject({
      name: "language",
      referenceType: "language",
    });
  });

  test("a disabled language is refused — enabled is exactly the question a new write asks", () => {
    expect(resolveV3WriteLanguage(languages, "fr").ok).toBe(false);
  });
});

describe("validateV3EndingId", () => {
  const endings = [{ id: "cmp1", type: "endScreen" }];

  test.each([null, undefined, "cmp1"])("%s is accepted", (endingId) => {
    expect(validateV3EndingId(endings, endingId)).toBeNull();
  });

  test("an ending from another survey is refused and names the id", () => {
    expect(validateV3EndingId(endings, "cmp-other")).toMatchObject({
      name: "endingId",
      referenceType: "ending",
      missingId: "cmp-other",
    });
  });
});

describe("normalizeV3Ttc", () => {
  /**
   * `_total` is derived, so a caller-supplied one would both contradict the sum of its own buckets
   * and be added into the total a second time by `calculateTtcTotal`.
   */
  test("a caller-supplied _total is dropped and recomputed on finish", () => {
    expect(normalizeV3Ttc({ q1: 1000, q2: 500, _total: 999_999 }, true)).toEqual({
      q1: 1000,
      q2: 500,
      _total: 1500,
    });
  });

  test("an unfinished response carries no total at all", () => {
    expect(normalizeV3Ttc({ q1: 1000 }, false)).toEqual({ q1: 1000 });
  });

  /** Client telemetry is clamped, never rejected: a laptop that slept mid-survey must not cost a response. */
  test.each([
    [-5, 0],
    [86_400_001, 86_400_000],
  ])("%d is clamped to %d", (input, expected) => {
    expect(normalizeV3Ttc({ q1: input }, false)).toEqual({ q1: expected });
  });

  test("an absent ttc is an empty map rather than a crash", () => {
    expect(normalizeV3Ttc(undefined, true)).toEqual({ _total: 0 });
  });
});
