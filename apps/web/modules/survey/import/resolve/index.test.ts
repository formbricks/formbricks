import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TActionClass } from "@formbricks/types/action-classes";
import {
  FIXTURE_APP_SURVEY,
  FIXTURE_CODE_ACTION_CLASS,
  FIXTURE_LINK_SURVEY,
  FIXTURE_NOCODE_ACTION_CLASS,
  FIXTURE_WORKSPACE_ID,
} from "@/modules/survey/export/__fixtures__/surveys";
import { buildSurveyExportEnvelope } from "@/modules/survey/export/build-export-envelope";
import { formbricksLane } from "../lanes/formbricks";
import type { TImportCandidate, TImportContext } from "../types";
import { type TResolveImportDeps, resolveImportCandidate } from "./index";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: { language: { findMany: vi.fn() } },
}));

vi.mock("@/lib/actionClass/service", () => ({ getActionClasses: vi.fn() }));
vi.mock("@/modules/survey/editor/lib/action-class", () => ({ createActionClass: vi.fn() }));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn() }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "https://app.formbricks.com",
}));

const laneCtx: TImportContext = {
  workspaceId: FIXTURE_WORKSPACE_ID,
  organizationId: "org_1",
  userId: "user_1",
  requestId: "req_1",
  importRunId: "run_1",
};

const resolveCtx = {
  workspaceId: FIXTURE_WORKSPACE_ID,
  organizationId: "org_1",
  userId: "user_1",
  requestId: "req_1",
  dryRun: false,
};

const existingCodeAction: TActionClass = {
  ...FIXTURE_CODE_ACTION_CLASS,
  id: "claaexisting00000000000001",
  name: "Purchase done",
};

const deps = {
  listActionClasses: vi.fn<TResolveImportDeps["listActionClasses"]>(),
  createActionClass: vi.fn<TResolveImportDeps["createActionClass"]>(),
  listWorkspaceLanguageCodes: vi.fn<TResolveImportDeps["listWorkspaceLanguageCodes"]>(),
  isExternalUrlAllowed: vi.fn<TResolveImportDeps["isExternalUrlAllowed"]>(),
  instanceUrl: "https://app.formbricks.com",
};

async function candidateFor(survey: typeof FIXTURE_LINK_SURVEY): Promise<TImportCandidate> {
  const result = buildSurveyExportEnvelope(survey, {
    appVersion: "6.2.0",
    publicUrl: "https://source.example",
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return formbricksLane(
    {
      kind: "formbricks-export",
      fileName: "x.formbricks.json",
      content: { type: "json", value: result.data },
    },
    laneCtx
  );
}

function codes(issues: { code: string }[]): string[] {
  return issues.map((issue) => issue.code);
}

describe("resolveImportCandidate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    deps.listActionClasses.mockResolvedValue([existingCodeAction]);
    deps.createActionClass.mockImplementation(async (_workspaceId, input) => ({
      id: input.type === "code" ? "claacreatedcode0000000001" : "claacreatednocode00000001",
    }));
    deps.listWorkspaceLanguageCodes.mockResolvedValue(["en-US"]);
    deps.isExternalUrlAllowed.mockResolvedValue(true);
  });

  test("resolves a link export: valid create body, languages reported, settings note, no errors", async () => {
    const result = await resolveImportCandidate(await candidateFor(FIXTURE_LINK_SURVEY), resolveCtx, deps);

    expect(result.validation).toEqual({ valid: true, invalid_params: [] });
    expect(result.createBody).toMatchObject({
      workspaceId: FIXTURE_WORKSPACE_ID,
      status: "draft",
      type: "link",
    });
    expect(result.document).toMatchObject({ status: "draft" });
    expect(result.document).not.toHaveProperty("workspaceId");
    // The picture-selection fixture hosts its images on example.com, hence the external-asset note.
    expect(codes(result.report.issues)).toEqual([
      "status_reset",
      "language_created",
      "asset_url_external",
      "settings_not_exported",
    ]);
    expect(result.report.issues[1]).toMatchObject({ vars: { code: "de-DE" } });
    expect(result.report.summary).toMatchObject({
      blocks: 3,
      elements: 17,
      endings: 1,
      languages: ["en-US", "de-DE"],
      logicRules: 1,
      hiddenFields: 2,
    });
    expect(deps.createActionClass).not.toHaveBeenCalled();
  });

  test("app export: matches one trigger by key, creates the other with an (imported) suffix on a name clash", async () => {
    deps.listActionClasses.mockResolvedValue([
      { ...FIXTURE_CODE_ACTION_CLASS, id: "claaexisting00000000000001" },
      // Same name as the exported no-code action but a different type: not a match, but a name clash.
      {
        ...FIXTURE_CODE_ACTION_CLASS,
        id: "claaother0000000000000001",
        name: "Clicked pricing",
        key: "pricing_clicked",
      },
    ]);

    const result = await resolveImportCandidate(await candidateFor(FIXTURE_APP_SURVEY), resolveCtx, deps);

    expect(result.validation.valid).toBe(true);
    expect(result.createBody?.distribution?.triggers).toEqual([
      { actionClassId: "claaexisting00000000000001" },
      { actionClassId: "claacreatednocode00000001" },
    ]);
    expect(deps.createActionClass).toHaveBeenCalledWith(FIXTURE_WORKSPACE_ID, {
      workspaceId: FIXTURE_WORKSPACE_ID,
      name: "Clicked pricing (imported)",
      description: undefined,
      type: "noCode",
      noCodeConfig: FIXTURE_NOCODE_ACTION_CLASS.noCodeConfig,
    });
    expect(codes(result.report.issues)).toContain("trigger_mapped");
    expect(codes(result.report.issues)).toContain("trigger_created");
    expect(result.document).not.toHaveProperty("targeting");
  });

  test("dryRun reports what would be created and writes nothing", async () => {
    const result = await resolveImportCandidate(
      await candidateFor(FIXTURE_APP_SURVEY),
      { ...resolveCtx, dryRun: true },
      deps
    );

    expect(deps.createActionClass).not.toHaveBeenCalled();
    expect(codes(result.report.issues)).toContain("trigger_would_be_created");
    expect(result.report.issues.find((issue) => issue.code === "trigger_would_be_created")).toMatchObject({
      vars: { name: "Clicked pricing" },
    });
    expect(result.validation.valid).toBe(true);
  });

  test("keeps triggers whose action class already exists in the workspace, without references (idempotent)", async () => {
    const first = await resolveImportCandidate(await candidateFor(FIXTURE_APP_SURVEY), resolveCtx, deps);
    deps.listActionClasses.mockResolvedValue([
      existingCodeAction,
      { ...FIXTURE_CODE_ACTION_CLASS, id: "claacreatedcode0000000001" },
      { ...FIXTURE_NOCODE_ACTION_CLASS, id: "claacreatednocode00000001" },
    ]);
    deps.listWorkspaceLanguageCodes.mockResolvedValue(["en-US", "de-DE"]);

    const second = await resolveImportCandidate(
      { document: first.document, issues: [], source: { lane: "lossless", kind: "v3-document" } },
      resolveCtx,
      deps
    );

    expect(second.validation.valid).toBe(true);
    // The external-asset note is a fact about the file, so it is the one line a second pass repeats.
    expect(codes(second.report.issues).filter((code) => code !== "asset_url_external")).toEqual([]);
    expect(second.createBody?.distribution?.triggers).toEqual(first.createBody?.distribution?.triggers);
    expect(deps.createActionClass).toHaveBeenCalledTimes(1);
  });

  test("drops a trigger with no definition, removes distribution from a link survey", async () => {
    const appCandidate = await candidateFor(FIXTURE_APP_SURVEY);
    const noReferences = { ...appCandidate, references: { actionClasses: [] } };
    deps.listActionClasses.mockResolvedValue([]);

    const dropped = await resolveImportCandidate(noReferences, resolveCtx, deps);
    expect(codes(dropped.report.issues).filter((code) => code === "trigger_dropped")).toHaveLength(2);
    expect(dropped.createBody?.distribution?.triggers).toEqual([]);

    const linkWithDistribution = await candidateFor(FIXTURE_LINK_SURVEY);
    (linkWithDistribution.document as Record<string, unknown>).distribution = {
      displayOption: "displayOnce",
      triggers: [],
    };
    const link = await resolveImportCandidate(linkWithDistribution, resolveCtx, deps);
    expect(link.validation.valid).toBe(true);
    expect(link.report.issues).toContainEqual(
      expect.objectContaining({ code: "unknown_field_stripped", path: "distribution" })
    );
  });

  test("deletes hand-crafted targeting with a note only when it has filters", async () => {
    const candidate = await candidateFor(FIXTURE_APP_SURVEY);
    const document = candidate.document as Record<string, unknown>;
    document.targeting = { filters: [{ id: "f1" }] };

    const result = await resolveImportCandidate(candidate, resolveCtx, deps);
    expect(result.validation.valid).toBe(true);
    expect(codes(result.report.issues)).toContain("targeting_not_imported");

    document.targeting = { filters: [] };
    const silent = await resolveImportCandidate(candidate, resolveCtx, deps);
    expect(codes(silent.report.issues)).not.toContain("targeting_not_imported");
    expect(silent.document).not.toHaveProperty("targeting");
  });

  test("strips external URLs when the organization lacks the entitlement", async () => {
    deps.isExternalUrlAllowed.mockResolvedValue(false);
    const candidate = await candidateFor(FIXTURE_LINK_SURVEY);
    const document = candidate.document as Record<string, unknown>;
    const blocks = document.blocks as { elements: Record<string, unknown>[] }[];
    const cta = blocks[0].elements.find((element) => element.type === "cta")!;
    cta.buttonExternal = true;
    cta.buttonUrl = "https://example.com";
    (document.endings as Record<string, unknown>[]).push({
      id: "clen0000000000000000000002",
      type: "redirectToUrl",
      url: "https://example.com/next",
      label: "Go on",
    });

    const result = await resolveImportCandidate(candidate, resolveCtx, deps);

    expect(result.validation.valid, JSON.stringify(result.validation)).toBe(true);
    expect(codes(result.report.issues).filter((code) => code === "external_url_removed")).toHaveLength(3);
    const resolvedCta = (
      result.document?.blocks as { elements: Record<string, unknown>[] }[]
    )[0].elements.find((element) => element.type === "cta");
    expect(resolvedCta).toMatchObject({ buttonExternal: false });
    expect(resolvedCta).not.toHaveProperty("buttonUrl");
    const endings = result.document?.endings as Record<string, unknown>[];
    expect(endings[0]).not.toHaveProperty("buttonLink");
    expect(endings[1]).toEqual({
      id: "clen0000000000000000000002",
      type: "endScreen",
      headline: { "en-US": "Go on", "de-DE": "Go on" },
    });
  });

  test("removes invalid media with a warning and notes foreign-hosted images", async () => {
    const candidate = await candidateFor(FIXTURE_LINK_SURVEY);
    const document = candidate.document as Record<string, unknown>;
    const blocks = document.blocks as { elements: Record<string, unknown>[] }[];
    blocks[0].elements[0].imageUrl = "https://evil.example/pic.svg";
    blocks[0].elements[1].videoUrl = "https://example.com/video.mp4";
    blocks[0].elements[2].imageUrl = "https://other-instance.example/storage/ws/public/a.png";

    const result = await resolveImportCandidate(candidate, resolveCtx, deps);

    expect(result.validation.valid).toBe(true);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: "media_invalid", path: "blocks.0.elements.0.imageUrl" })
    );
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: "media_invalid", path: "blocks.0.elements.1.videoUrl" })
    );
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: "asset_url_external", path: "blocks.0.elements.2.imageUrl" })
    );
    const resolvedBlocks = result.document?.blocks as { elements: Record<string, unknown>[] }[];
    expect(resolvedBlocks[0].elements[0]).not.toHaveProperty("imageUrl");
    expect(resolvedBlocks[0].elements[2].imageUrl).toBe(
      "https://other-instance.example/storage/ws/public/a.png"
    );
  });

  test("strips pre-D1 fields with their path and keeps the rest", async () => {
    const candidate = await candidateFor(FIXTURE_LINK_SURVEY);
    const document = candidate.document as Record<string, unknown>;
    document.styling = { brandColor: "#000" };
    document.followUps = [];
    (document.blocks as Record<string, unknown>[])[0].customFlag = true;
    document.slug = "hand-edited";

    const result = await resolveImportCandidate(candidate, resolveCtx, deps);

    expect(result.validation.valid, JSON.stringify(result.validation)).toBe(true);
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: "unknown_field_stripped", path: "styling" })
    );
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: "unknown_field_stripped", path: "followUps" })
    );
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({ code: "unknown_field_stripped", path: "blocks.0.customFlag" })
    );
    expect(result.report.issues).toContainEqual(expect.objectContaining({ code: "slug_not_imported" }));
    expect(result.document).not.toHaveProperty("styling");
  });

  test("an unknown element type is fatal", async () => {
    const candidate = await candidateFor(FIXTURE_LINK_SURVEY);
    const blocks = (candidate.document as Record<string, unknown>).blocks as {
      elements: Record<string, unknown>[];
    }[];
    blocks[0].elements[0].type = "hologram";

    const result = await resolveImportCandidate(candidate, resolveCtx, deps);

    expect(result.document).toBeNull();
    expect(result.createBody).toBeNull();
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "unknown_element",
        path: "blocks.0.elements.0.type",
      })
    );
    expect(deps.listWorkspaceLanguageCodes).not.toHaveBeenCalled();
  });

  test("a dangling jumpToBlock fails v3 validation and lands in the report and validation", async () => {
    const candidate = await candidateFor(FIXTURE_LINK_SURVEY);
    const blocks = (candidate.document as Record<string, unknown>).blocks as Record<string, unknown>[];
    (blocks[0].logic as { actions: { target: string }[] }[])[0].actions[0].target =
      "clbkmissing000000000000001";

    const result = await resolveImportCandidate(candidate, resolveCtx, deps);

    expect(result.document).toBeNull();
    expect(result.validation.valid).toBe(false);
    expect(result.validation.invalid_params[0]).toMatchObject({
      name: "blocks.0.logic.0.actions.0.target",
      code: "dangling_reference",
    });
    expect(result.report.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "invalid_document",
        path: "blocks.0.logic.0.actions.0.target",
      })
    );
  });

  test("normalizes language codes, rewrites translation keys, and fails on an unknown code", async () => {
    const candidate = await candidateFor(FIXTURE_LINK_SURVEY);
    const document = candidate.document as Record<string, unknown>;
    (document.languages as { code: string }[])[1].code = "de_de";
    const headline = (document.blocks as { elements: Record<string, unknown>[] }[])[0].elements[0]
      .headline as Record<string, string>;
    headline.de_de = headline["de-DE"];
    delete headline["de-DE"];

    const result = await resolveImportCandidate(candidate, resolveCtx, deps);
    expect(result.validation.valid, JSON.stringify(result.validation)).toBe(true);
    expect((result.document?.languages as { code: string }[])[1].code).toBe("de-DE");

    document.defaultLanguage = "klingon";
    const unknown = await resolveImportCandidate(candidate, resolveCtx, deps);
    expect(unknown.document).toBeNull();
    expect(unknown.report.issues).toContainEqual(
      expect.objectContaining({ severity: "error", code: "language_unknown" })
    );
  });

  test("applies the review name override and passes fatal lane issues through untouched", async () => {
    const candidate = await candidateFor(FIXTURE_LINK_SURVEY);
    const renamed = await resolveImportCandidate(
      candidate,
      { ...resolveCtx, name: "  Renamed (imported) " },
      deps
    );
    expect(renamed.createBody?.name).toBe("Renamed (imported)");

    const fatal = await resolveImportCandidate(
      {
        document: null,
        issues: [{ severity: "error", code: "legacy_questions_unsupported", message: "legacy" }],
        source: { lane: "lossless", kind: "v3-document" },
      },
      resolveCtx,
      deps
    );
    expect(fatal.document).toBeNull();
    expect(fatal.report.issues).toHaveLength(1);
    // Only the rename run above reached the language step; the fatal candidate never did.
    expect(deps.listWorkspaceLanguageCodes).toHaveBeenCalledTimes(1);
  });

  test("a minimal raw document comes back complete, with the create defaults filled in", async () => {
    const result = await resolveImportCandidate(
      {
        document: {
          name: "Minimal",
          blocks: [
            {
              name: "Main",
              elements: [{ id: "why", type: "openText", headline: { "en-US": "Why?" }, required: true }],
            },
          ],
        },
        issues: [],
        source: { lane: "lossless", kind: "v3-document" },
      },
      resolveCtx,
      deps
    );

    expect(result.validation.valid).toBe(true);
    expect(result.document).toMatchObject({
      type: "link",
      status: "draft",
      metadata: {},
      defaultLanguage: "en-US",
      languages: [],
      welcomeCard: { enabled: false },
      endings: [],
      hiddenFields: { enabled: false },
      variables: [],
    });
    expect(JSON.stringify(result.document)).not.toContain('"default"');
  });

  test("the QSF source kind does not get the settings note", async () => {
    const candidate = await candidateFor(FIXTURE_LINK_SURVEY);
    const result = await resolveImportCandidate(
      { ...candidate, references: undefined, source: { lane: "structured", kind: "qsf" } },
      resolveCtx,
      deps
    );

    expect(codes(result.report.issues)).not.toContain("settings_not_exported");
  });
});
