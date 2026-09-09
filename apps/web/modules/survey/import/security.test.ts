/**
 * Security review checklist (ENG-3010): each test is one item of the review with a claim a reviewer
 * can rerun. Items that live in other suites are referenced from the ticket comment, not duplicated.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { FIXTURE_LINK_SURVEY, FIXTURE_WORKSPACE_ID } from "@/modules/survey/export/__fixtures__/surveys";
import { buildSurveyExportEnvelope } from "@/modules/survey/export/build-export-envelope";
import { extractDocumentText } from "./lanes/document/extract";
import { formbricksLane } from "./lanes/formbricks";
import { stripHtml } from "./lanes/qsf/strip-html";
import { type TResolveImportDeps, resolveImportCandidate } from "./resolve";
import type { TImportContext } from "./types";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@/lib/actionClass/service", () => ({ getActionClasses: vi.fn() }));
vi.mock("@/modules/survey/editor/lib/action-class", () => ({ createActionClass: vi.fn() }));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn() }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "https://app.formbricks.com",
}));

const FIXTURES = join(__dirname, "lanes/document/__fixtures__");
const laneCtx: TImportContext = {
  workspaceId: FIXTURE_WORKSPACE_ID,
  organizationId: "org_1",
  userId: "user_1",
  requestId: "req_1",
  importRunId: "run_1",
};
const resolveCtx = { ...laneCtx, dryRun: true };
const deps: TResolveImportDeps = {
  listActionClasses: async () => [],
  createActionClass: vi.fn(),
  listWorkspaceLanguageCodes: async () => ["en-US", "de-DE"],
  isExternalUrlAllowed: async () => true,
  instanceUrl: "https://app.formbricks.com",
};

function exportEnvelope(): Record<string, unknown> {
  const result = buildSurveyExportEnvelope(FIXTURE_LINK_SURVEY, {
    appVersion: "6.2.0",
    publicUrl: "https://x",
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return JSON.parse(JSON.stringify(result.data));
}

describe("files", () => {
  test("a truncated DOCX fails within the timeout with a clean error, no hang", async () => {
    const whole = readFileSync(join(FIXTURES, "survey-numbered-lists.docx"));
    const truncated = whole.subarray(0, Math.floor(whole.length / 2));
    const started = Date.now();

    const result = await extractDocumentText("docx", truncated);

    expect(Date.now() - started).toBeLessThan(10_000);
    expect(result.text).toBe("");
    expect(result.issues[0]).toMatchObject({ severity: "error", code: "document_unreadable" });
  });

  test("binary garbage with a .md extension is treated as text and never parsed as anything else", async () => {
    const garbage = Buffer.from(Array.from({ length: 4096 }, (_, index) => (index * 7919) % 256));
    const result = await extractDocumentText("markdown", garbage);
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(typeof result.text).toBe("string");
  });

  test("a 2 MB deeply nested JSON document does not crash the lossless lane", async () => {
    const depth = 250_000;
    const nested = `{"name":"x","blocks":${"[".repeat(depth)}${"]".repeat(depth)}}`;
    expect(nested.length).toBeGreaterThan(400_000);

    const candidate = await formbricksLane(
      { kind: "v3-document", fileName: "deep.json", content: { type: "bytes", bytes: Buffer.from(nested) } },
      laneCtx
    );

    expect(candidate.document).toBeNull();
    expect(candidate.issues[0].severity).toBe("error");
  });

  test("nothing in the import module fetches a URL from a document (media URLs stay strings)", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (entry !== "__fixtures__" && entry !== "__snapshots__") walk(path);
          continue;
        }
        if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
        // The two browser clients call our own API; everything else must not reach the network.
        if (entry === "import-client.ts" || entry === "import-stream-client.ts") continue;
        const source = readFileSync(path, "utf8");
        if (/\bfetch\s*\(|new\s+XMLHttpRequest|https?\.request\(|axios/.test(source)) offenders.push(path);
      }
    };
    walk(__dirname);
    expect(offenders).toEqual([]);
  });
});

describe("content", () => {
  test("hostile HTML in QSF text loses scripts, event handlers and javascript: links", () => {
    const hostile =
      '<p>Rate <script>alert(1)</script>us <img src=x onerror="alert(1)"> <a href="javascript:steal()">here</a> &lt;b&gt;</p>';
    const clean = stripHtml(hostile);

    expect(clean).not.toMatch(/<script|onerror|javascript:|<img|<a /i);
    expect(clean).toContain("Rate");
    expect(clean).toContain("here");
  });

  test("a recall that points at a forbidden or unknown id is caught by the reference validator", async () => {
    const envelope = exportEnvelope();
    const survey = envelope.survey as { blocks: { elements: { headline: Record<string, string> }[] }[] };
    survey.blocks[0].elements[0].headline["en-US"] =
      "Hi #recall:userId/fallback:#, and #recall:nope123/fallback:#";
    survey.blocks[0].elements[0].headline["de-DE"] = "Hallo #recall:userId/fallback:#";

    const candidate = await formbricksLane(
      {
        kind: "formbricks-export",
        fileName: "x.formbricks.json",
        content: { type: "json", value: envelope },
      },
      laneCtx
    );
    const resolved = await resolveImportCandidate(candidate, resolveCtx, deps);

    expect(resolved.document).toBeNull();
    expect(resolved.createBody).toBeNull();
    expect(resolved.report.issues.some((issue) => issue.severity === "error")).toBe(true);
  });

  test("instance-bound and pre-D1 fields in a hand-crafted export never reach the create payload", async () => {
    const envelope = exportEnvelope();
    Object.assign(envelope.survey as Record<string, unknown>, {
      id: "clsurvey0000000000000000001",
      workspaceId: "clother00000000000000000001",
      createdBy: "someone",
      archivedAt: "2026-01-01T00:00:00.000Z",
      customHeadScripts: "<script>alert(1)</script>",
      customHeadScriptsMode: "all",
      slug: "stolen-slug",
      publishOn: "2026-01-01T00:00:00.000Z",
      closeOn: "2026-02-01T00:00:00.000Z",
      segmentId: "clsegment00000000000000001",
      followUps: [{ id: "f1" }],
      styling: { brandColor: "#000" },
      targeting: { segment: { filters: [{ x: 1 }] } },
      status: "inProgress",
    });

    const candidate = await formbricksLane(
      {
        kind: "formbricks-export",
        fileName: "x.formbricks.json",
        content: { type: "json", value: envelope },
      },
      laneCtx
    );
    const resolved = await resolveImportCandidate(candidate, resolveCtx, deps);

    expect(resolved.createBody, JSON.stringify(resolved.report.issues)).not.toBeNull();
    const keys = Object.keys(resolved.createBody as object);
    for (const forbidden of [
      "id",
      "createdBy",
      "archivedAt",
      "customHeadScripts",
      "customHeadScriptsMode",
      "slug",
      "publishOn",
      "closeOn",
      "segmentId",
      "followUps",
      "styling",
      "targeting",
    ]) {
      expect(keys, forbidden).not.toContain(forbidden);
    }
    expect(resolved.createBody?.workspaceId).toBe(FIXTURE_WORKSPACE_ID);
    expect(resolved.createBody?.status).toBe("draft");
    expect(resolved.report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "slug_not_imported",
        "schedule_cleared",
        "status_reset",
        "unknown_field_stripped",
      ])
    );
    expect(deps.createActionClass).not.toHaveBeenCalled();
  });
});
