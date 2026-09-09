import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { type TResolveImportDeps, resolveImportCandidate } from "../../resolve";
import type { TImportContext } from "../../types";
import { qsfLane } from "./index";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { language: { findMany: vi.fn() } } }));
vi.mock("@/lib/actionClass/service", () => ({ getActionClasses: vi.fn() }));
vi.mock("@/modules/survey/editor/lib/action-class", () => ({ createActionClass: vi.fn() }));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn() }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "https://app.formbricks.com",
}));

const FIXTURES = join(__dirname, "__fixtures__");
const read = (name: string) => readFileSync(join(FIXTURES, name));

const ctx: TImportContext = {
  workspaceId: "clxx1234567890123456789012",
  organizationId: "org_1",
  userId: "user_1",
  requestId: "req_1",
  importRunId: "run_1",
};

const deps: TResolveImportDeps = {
  listActionClasses: async () => [],
  createActionClass: async () => ({ id: "claa0000000000000000000001" }),
  listWorkspaceLanguageCodes: async () => ["en-US"],
  isExternalUrlAllowed: async () => true,
  instanceUrl: "https://app.formbricks.com",
};

/** Random cuids masked so the golden compares structure and content only. */
const stable = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (key, entry: unknown) =>
      key === "id" && typeof entry === "string" && /^[a-z0-9]{24}$/.test(entry) ? "<cuid>" : entry
    )
  );

const GOLDEN = [
  "simple.qsf",
  "multilang-en-de.qsf",
  "logic-skip-display-branch.qsf",
  "matrix-slider-ranking.qsf",
  "pages-and-blocks.qsf",
  "embedded-data.qsf",
  "legacy-object-payload.qsf",
  "nps-and-numeric-scales.qsf",
];

describe("nps-and-numeric-scales.qsf (a real export with a top-level NPS type)", () => {
  test("maps the NPS question type, turns 1–5 numeric choice scales into ratings and keeps the dropdown", async () => {
    const candidate = await qsfLane(
      {
        kind: "qsf",
        fileName: "nps-and-numeric-scales.qsf",
        content: { type: "bytes", bytes: read("nps-and-numeric-scales.qsf") },
      },
      ctx
    );
    const elements = (
      (candidate.document as { blocks: { elements: Record<string, unknown>[] }[] }).blocks ?? []
    ).flatMap((block) => block.elements);

    expect(elements.map((element) => element.type)).toEqual([
      "multipleChoiceSingle",
      "multipleChoiceSingle",
      "rating",
      "rating",
      "nps",
      "openText",
    ]);
    expect(elements[1]).toMatchObject({ displayType: "dropdown" });
    expect(elements[2]).toMatchObject({
      scale: "number",
      range: 5,
      lowerLabel: { "en-US": "Very dissatisfied" },
      upperLabel: { "en-US": "Very satisfied" },
    });
    expect(elements[3]).toMatchObject({
      range: 5,
      lowerLabel: { "en-US": "Very difficult" },
      upperLabel: { "en-US": "Very easy" },
    });
    expect(candidate.issues.map((issue) => issue.code)).not.toContain("unsupported_question_type");
    expect(candidate.issues.filter((issue) => issue.code === "type_approximated")).toHaveLength(2);
  });
});

describe("qsfLane", () => {
  test.each(GOLDEN)("%s: the full lane output matches its golden", async (name) => {
    const candidate = await qsfLane(
      { kind: "qsf", fileName: name, content: { type: "bytes", bytes: read(name) } },
      ctx
    );

    expect(candidate.source).toEqual({ lane: "structured", kind: "qsf", fileName: name });
    await expect(
      JSON.stringify(
        {
          document: stable(candidate.document),
          issues: candidate.issues,
          logicRulesReported: candidate.logicRulesReported,
        },
        null,
        2
      )
    ).toMatchFileSnapshot(join(FIXTURES, name.replace(/\.qsf$/, ".golden.snap")));
  });

  test("every fixture resolves to a valid create body through the shared resolver", async () => {
    for (const name of GOLDEN) {
      const candidate = await qsfLane(
        { kind: "qsf", fileName: name, content: { type: "bytes", bytes: read(name) } },
        ctx
      );
      const resolved = await resolveImportCandidate(candidate, { ...ctx, dryRun: true }, deps);
      expect(
        resolved.validation.valid,
        `${name}: ${JSON.stringify(resolved.validation.invalid_params)}`
      ).toBe(true);
      expect(resolved.report.summary.logicRules).toBe(0);
      expect(resolved.report.issues.map((issue) => issue.code)).not.toContain("settings_not_exported");
    }
  });

  test("the logic fixture reports six rules and keeps its hidden field", async () => {
    const candidate = await qsfLane(
      { kind: "qsf", content: { type: "bytes", bytes: read("logic-skip-display-branch.qsf") } },
      ctx
    );
    const resolved = await resolveImportCandidate(candidate, { ...ctx, dryRun: true }, deps);

    expect(resolved.report.summary).toMatchObject({
      logicRulesReported: 6,
      hiddenFields: 1,
      languages: ["en-US"],
    });
    expect(resolved.report.issues.filter((issue) => issue.code === "logic_dropped")).toHaveLength(7);
    expect(JSON.stringify(resolved.document)).not.toContain('"logic"');
  });

  test("invalid input is fatal without throwing, and text/json content is accepted", async () => {
    const broken = await qsfLane({ kind: "qsf", content: { type: "text", text: "{ nope" } }, ctx);
    expect(broken.document).toBeNull();
    expect(broken.issues[0]).toMatchObject({ severity: "error", code: "invalid_document" });

    const asJson = await qsfLane(
      { kind: "qsf", content: { type: "json", value: JSON.parse(read("simple.qsf").toString("utf8")) } },
      ctx
    );
    expect(asJson.document).not.toBeNull();
  });

  test("large-150.qsf converts and resolves end to end in under 2 s (5 s CI margin)", async () => {
    const started = performance.now();
    const candidate = await qsfLane(
      { kind: "qsf", fileName: "large-150.qsf", content: { type: "bytes", bytes: read("large-150.qsf") } },
      ctx
    );
    const resolved = await resolveImportCandidate(candidate, { ...ctx, dryRun: true }, deps);
    const elapsed = performance.now() - started;

    expect(resolved.validation.valid).toBe(true);
    expect(resolved.report.summary.elements).toBeGreaterThanOrEqual(135);
    expect(elapsed).toBeLessThan(5000);
  });
});
