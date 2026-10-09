import { describe, expect, test, vi } from "vitest";
import { getCustomCssPlanAllowed } from "./access";
import { previewCustomCss, resolveCustomCssWrite } from "./service";

/**
 * Against the real processor (ENG-3641 "UI, REST and MCP produce the same processed output and warnings
 * for identical source"): every surface reaches the processor through these two functions — the dry run
 * behind `POST /api/v3/surveys/validate` / `validate_survey`, and the save behind the editor, PATCH and
 * the MCP writes — so they must agree byte for byte.
 */

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@/lib/cache", () => ({ cache: { del: vi.fn() } }));
vi.mock("./access", () => ({
  CUSTOM_CSS_PLAN_REQUIRED_MESSAGE: "Adding or editing custom CSS requires the Scale plan.",
  getCustomCssPlanAllowed: vi.fn(),
}));

const SOURCE = {
  light:
    '@import url("https://fonts.googleapis.com/css2?family=Inter");\n[data-fb-part="headline"] { font-weight: 600; }',
  dark: '#fbjs[data-appearance="dark"] { --acme-ink: #e6eef5; }',
};

describe("one processor for preview and save", () => {
  test.each(["survey", "workspace"] as const)("%s scope: preview and save agree", async (scope) => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(true);

    const preview = previewCustomCss(scope, SOURCE);
    const saved = await resolveCustomCssWrite({
      scope,
      organizationId: "org_1",
      existing: null,
      input: SOURCE,
    });

    expect(preview.ok).toBe(true);
    expect(saved.ok).toBe(true);
    if (!preview.ok || !saved.ok || !saved.stored) throw new Error("unreachable");

    expect(saved.stored.light?.compiled).toBe(preview.compiled.light);
    expect(saved.stored.dark?.compiled).toBe(preview.compiled.dark);
    expect(saved.warnings).toEqual(preview.warnings);
    expect(preview.warnings.map((warning) => warning.code)).toContain("import_removed");
    // Source is stored as typed, the @import included; only the compiled output drops it.
    expect(saved.stored.light?.source).toBe(SOURCE.light);
    expect(saved.stored.light?.compiled).not.toContain("@import");
  });

  test("a syntax error is rejected the same way by both, with no output", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(true);
    const broken = { light: '[data-fb-part="headline"] { color: red } }', dark: null };

    const preview = previewCustomCss("survey", broken);
    const saved = await resolveCustomCssWrite({
      scope: "survey",
      organizationId: "org_1",
      existing: null,
      input: broken,
    });

    expect(preview.ok).toBe(false);
    expect(saved).toMatchObject({ ok: false, code: "invalid_css" });
    if (preview.ok || saved.ok || saved.code !== "invalid_css") throw new Error("unreachable");
    expect(saved.errors).toEqual(preview.errors);
  });
});
