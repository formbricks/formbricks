import "server-only";
import { prisma } from "@formbricks/database";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import { getActionClasses } from "@/lib/actionClass/service";
import { WEBAPP_URL } from "@/lib/constants";
import { createActionClass } from "@/modules/survey/editor/lib/action-class";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { createImportReport, hasFatalIssues, importError, importInfo, summarizeDocument } from "../report";
import type { TImportCandidate, TImportIssue, TImportReport } from "../types";
import type { TActionClassResolutionDeps } from "./action-classes";
import { resolveImportActionClasses } from "./action-classes";
import { applyDocumentHygiene } from "./document";
import { hasImportExternalUrls, stripImportExternalUrls } from "./entitlements";
import { resolveImportLanguages } from "./languages";
import { resolveImportMedia } from "./media";
import { resolveImportTargeting } from "./targeting";

export type TResolveImportContext = {
  workspaceId: string;
  organizationId: string;
  userId: string | null;
  requestId: string;
  /** Report what would be created instead of creating it; nothing is written. */
  dryRun: boolean;
  /** Overrides `document.name` when the user renamed the survey in the review step. */
  name?: string;
};

/** Injectable I/O so the pipeline is unit-testable without a database. */
export type TResolveImportDeps = TActionClassResolutionDeps & {
  listWorkspaceLanguageCodes: (workspaceId: string) => Promise<string[]>;
  isExternalUrlAllowed: (organizationId: string) => Promise<boolean>;
  instanceUrl?: string;
};

export type TResolveImportResult = {
  /** The resolved document in its public shape (locale-code maps), ready to be sent back to the API. */
  document: Record<string, unknown> | null;
  /** The parsed create body the import route persists; null when the report has errors. */
  createBody: TV3CreateSurveyBody | null;
  report: TImportReport;
  validation: { valid: boolean; invalid_params: InvalidParam[] };
};

const defaultDeps: TResolveImportDeps = {
  listActionClasses: getActionClasses,
  createActionClass: (workspaceId, input) => createActionClass(workspaceId, input),
  listWorkspaceLanguageCodes: async (workspaceId) => {
    const languages = await prisma.language.findMany({ where: { workspaceId }, select: { code: true } });
    return languages.map((language) => language.code);
  },
  isExternalUrlAllowed: getExternalUrlsPermission,
  instanceUrl: WEBAPP_URL,
};

function invalidParamToIssue(param: InvalidParam): TImportIssue {
  return importError({
    code: "invalid_document",
    path: param.name,
    message: param.reason,
    vars: { detail: param.reason, ...(param.code ? { v3Code: param.code } : {}) },
  });
}

/**
 * Turn a lane's candidate into a document the target workspace can hold, and say what changed.
 *
 * Steps run in a fixed order — hygiene, languages, action classes, targeting, external URLs, media,
 * validation — and each one only appends to the issue list. Resolving an already-resolved document
 * adds no issues: ids that exist are kept, nothing left to strip, nothing left to warn about.
 */
export async function resolveImportCandidate(
  candidate: TImportCandidate,
  ctx: TResolveImportContext,
  deps: TResolveImportDeps = defaultDeps
): Promise<TResolveImportResult> {
  const report = createImportReport(candidate.source, candidate.issues);

  if (candidate.document === null || candidate.document === undefined || hasFatalIssues(candidate.issues)) {
    return {
      document: null,
      createBody: null,
      report,
      validation: { valid: false, invalid_params: [] },
    };
  }

  const hygiene = applyDocumentHygiene(candidate.document);
  const document = hygiene.document;
  report.issues.push(...hygiene.issues);

  if (ctx.name !== undefined && ctx.name.trim().length > 0) {
    document.name = ctx.name.trim();
  }

  if (hasFatalIssues(hygiene.issues)) {
    report.summary = summarizeDocument(document);
    return { document: null, createBody: null, report, validation: { valid: false, invalid_params: [] } };
  }

  const languages = resolveImportLanguages(document, await deps.listWorkspaceLanguageCodes(ctx.workspaceId));
  report.issues.push(...languages.issues);

  report.issues.push(
    ...(await resolveImportActionClasses({
      document,
      references: candidate.references?.actionClasses ?? [],
      workspaceId: ctx.workspaceId,
      dryRun: ctx.dryRun,
      deps,
    }))
  );

  report.issues.push(...resolveImportTargeting(document));

  if (hasImportExternalUrls(document) && !(await deps.isExternalUrlAllowed(ctx.organizationId))) {
    report.issues.push(...stripImportExternalUrls(document));
  }

  report.issues.push(...resolveImportMedia(document, deps.instanceUrl));

  if (candidate.source.kind === "formbricks-export") {
    report.issues.push(importInfo({ code: "settings_not_exported" }));
  }

  const preparation = prepareV3SurveyCreateInput({ ...document, workspaceId: ctx.workspaceId });
  report.summary = summarizeDocument(document);

  if (!preparation.ok) {
    report.issues.push(...preparation.validation.invalidParams.map(invalidParamToIssue));
    return {
      document: null,
      createBody: null,
      report,
      validation: { valid: false, invalid_params: preparation.validation.invalidParams },
    };
  }

  if (hasFatalIssues(report.issues)) {
    return { document: null, createBody: null, report, validation: { valid: false, invalid_params: [] } };
  }

  return {
    document,
    createBody: preparation.document,
    report,
    validation: { valid: true, invalid_params: [] },
  };
}
