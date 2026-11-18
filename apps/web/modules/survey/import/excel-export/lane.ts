import "server-only";
import { createId } from "@paralleldrive/cuid2";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TUserLocale } from "@formbricks/types/user";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import type { TV3SurveyResourceVisibility } from "@/app/api/v3/surveys/serializers";
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocaleOrDefault } from "@/lib/user/locale";
import { getTranslate } from "@/lingodotdev/server";
import { applyExcelExport } from "@/modules/survey/excel-export/apply";
import { createExcelExportLabels } from "@/modules/survey/excel-export/labels";
import type { TExcelExportRead } from "@/modules/survey/excel-export/read";
import { nameRefusalsBySheetRow } from "@/modules/survey/excel-export/refusal-rows";
import { exportFormbricksFile } from "@/modules/survey/formbricks-file/export";
import { getFormbricksFileSurveyLanguageCodes } from "@/modules/survey/formbricks-file/fit";
import { previewFormbricksFileImport } from "@/modules/survey/formbricks-file/import";
import { readFormbricksFile } from "@/modules/survey/formbricks-file/read";
import { type TUpdatableSurvey, buildFormbricksFileMatch } from "@/modules/survey/formbricks-file/update";
import { getElementDefaults, universalElementPresets } from "@/modules/survey/lib/element-presets";
import type { TSurveyImportLane } from "../core/lane";
import { type TPreparedFormbricksFileImport, toFormbricksFileImportResult } from "../formbricks/lane";

/**
 * The survey an Excel export names, as `findUpdatableSurvey` found it for the importing user: the survey
 * the sheet's edits are applied to, and the one the review offers to update.
 */
export interface TExcelExportTarget extends TUpdatableSurvey {
  /** How the importing user sees the survey, which its Formbricks file is written with. */
  visibility: TV3SurveyResourceVisibility;
}

/** What the stream route hands the Excel export lane: the sheet read in the upload's thread, and its survey. */
export interface TExcelExportImportInput {
  read: () => Promise<TExcelExportRead>;
  fileName: string;
  workspaceId: string;
  organizationId: string;
  authentication: TV3Authentication;
  target: TExcelExportTarget;
  /** The request's: the merge stops when the client leaves. */
  signal?: AbortSignal;
}

/** The locale the sheet says it was written in, when it is one of ours; the file is untrusted. */
const toExportLocale = (locale: string): TUserLocale =>
  AVAILABLE_LOCALES.find((available) => available === locale) ?? DEFAULT_LOCALE;

/**
 * The Excel export lane (ENG-6809): a survey's own Excel export, edited and imported through New survey ›
 * Import, which the route sends here when the survey it names is one the user may update. Read by its
 * layout, never by AI: the sheet's edited texts are written into the survey
 * (`applyExcelExport`), and the result goes on as a Formbricks file of that survey would — the same
 * preview, the same Match on the survey, the same Update (`PUT /api/internal/surveys/{id}/content`) and
 * the same create — so every check a Formbricks file import runs, runs here.
 *
 * Its draft is the survey with the sheet applied — texts changed, questions and options the sheet added
 * — so an Update never removes anything, and "Create a new survey" makes a copy with the sheet applied.
 * Everything that can refuse the sheet runs in `prepare`, before the stream opens.
 */
export const excelExportImportLane: TSurveyImportLane<
  TExcelExportImportInput,
  TPreparedFormbricksFileImport
> = {
  kind: "excel_export",
  usesAI: false,
  rateLimit: null,
  prepare: async ({ read, fileName, workspaceId, organizationId, authentication, target, signal }) => {
    const userId = getSessionUserId(authentication);
    const sheet = await read();
    // The importer's language names what the editor would add (a new block's buttons, a placeholder);
    // the sheet's own and English read its Type cells back.
    const [t, exportT, englishT] = await Promise.all([
      getUserLocaleOrDefault(userId).then((locale) => getTranslate(locale)),
      getTranslate(toExportLocale(sheet.locale)),
      getTranslate(DEFAULT_LOCALE),
    ]);
    const applied = await applyExcelExport(target.survey, {
      read: sheet,
      labels: createExcelExportLabels([exportT, englishT]),
      newElement: (type) =>
        ({
          ...universalElementPresets,
          ...getElementDefaults(type, undefined, t),
          id: createId(),
          type,
        }) as TSurveyElement,
      t,
      truncatedSuffix: exportT("workspace.surveys.export.excel.truncated"),
      signal,
    });

    const file = await exportFormbricksFile({ survey: applied.survey, visibility: target.visibility });
    const { draft, references, issues, plan } = await previewFormbricksFileImport({
      read: readFormbricksFile(file),
      workspaceId,
      organizationId,
      userId,
    });
    const match = await buildFormbricksFileMatch({
      survey: target.survey,
      hasResponses: target.hasResponses,
      // Checked as a Formbricks file's export time is: a survey changed since the export is offered
      // "Update anyway" rather than having the sheet's older texts written over the newer ones unasked.
      exportedUpdatedAt: sheet.updatedAt,
      draft,
      plan,
    });
    // The Update names what it refuses by field path; a sheet's reader knows rows.
    const named = {
      ...match,
      updateRefusal: nameRefusalsBySheetRow(
        match.updateRefusal,
        draft,
        sheet,
        getFormbricksFileSurveyLanguageCodes(draft)
      ),
    };
    return { draft, references, issues: [...applied.issues, ...issues], match: named, fileName };
  },
  run: ({ prepared, onProgress }) => {
    onProgress("assembling");
    return Promise.resolve(toFormbricksFileImportResult(prepared, "excel_export"));
  },
};
