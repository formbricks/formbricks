import { isRecord } from "../../shared/guards";
import { type ToolResult, getToolError } from "../../shared/tool-result";
import type {
  JsonRecord,
  PreviewMeta,
  PreviewSettings,
  RenderPayload,
  ShowSurveyData,
  SurveyDocument,
  SurveyLanguage,
} from "./types";

const asRecords = (value: unknown): JsonRecord[] => (Array.isArray(value) ? value.filter(isRecord) : []);

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

const readLanguages = (value: unknown): SurveyLanguage[] =>
  asRecords(value).flatMap((language) => {
    const code = asString(language.code);
    if (!code) return [];
    return [
      {
        code,
        default: language.default === true,
        enabled: language.enabled !== false,
        ...(asString(language.alias) ? { alias: asString(language.alias) } : {}),
      },
    ];
  });

const readSurvey = (data: unknown): SurveyDocument | undefined => {
  if (!isRecord(data)) return undefined;
  const id = asString(data.id);
  const name = asString(data.name);
  if (!id || name === undefined) return undefined;

  const languages = readLanguages(data.languages);
  const defaultLanguage =
    asString(data.defaultLanguage) ?? languages.find((language) => language.default)?.code ?? "default";

  return {
    id,
    name,
    type: asString(data.type) ?? "link",
    status: asString(data.status) ?? "draft",
    defaultLanguage,
    languages,
    showLanguageSwitch: typeof data.showLanguageSwitch === "boolean" ? data.showLanguageSwitch : null,
    welcomeCard: isRecord(data.welcomeCard) ? data.welcomeCard : null,
    blocks: asRecords(data.blocks),
    endings: asRecords(data.endings),
    hiddenFields: isRecord(data.hiddenFields) ? data.hiddenFields : null,
    variables: asRecords(data.variables),
    distribution: isRecord(data.distribution) ? data.distribution : null,
    targeting: isRecord(data.targeting) ? data.targeting : null,
    visibility: asString(data.visibility) ?? null,
  };
};

const isRenderPayload = (value: unknown): value is RenderPayload =>
  isRecord(value) &&
  isRecord(value.survey) &&
  Array.isArray(value.survey.languages) &&
  typeof value.survey.type === "string" &&
  isRecord(value.styling);

const isSettings = (value: unknown): value is PreviewSettings =>
  isRecord(value) && Array.isArray(value.triggers) && typeof value.displayOption === "string";

const readMeta = (result: ToolResult): PreviewMeta | null => {
  const formbricks = result._meta?.formbricks;
  if (!isRecord(formbricks)) return null;
  const { appUrl, rendererUrl, surveyUrl, render, settings, problems } = formbricks;
  if (typeof appUrl !== "string" || typeof rendererUrl !== "string") return null;
  if (!isRenderPayload(render) || !isSettings(settings)) return null;
  return {
    appUrl,
    rendererUrl,
    surveyUrl: typeof surveyUrl === "string" ? surveyUrl : null,
    render,
    settings,
    problems: Array.isArray(problems)
      ? problems.filter((item): item is string => typeof item === "string")
      : [],
  };
};

const readWarnings = (structured: JsonRecord | undefined): string[] => {
  const warnings = structured?.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((warning) => {
    if (typeof warning === "string") return [warning];
    if (isRecord(warning)) {
      const message = asString(warning.message) ?? asString(warning.detail);
      return message ? [message] : [];
    }
    return [];
  });
};

export type ParsedResult =
  | { kind: "ok"; data: ShowSurveyData }
  | { kind: "error"; message: string }
  | { kind: "unreadable" };

/**
 * Splits a `show_survey` result into the survey, the render data and the failure case. A result that is
 * neither (a host replaying something else) is `unreadable`, which the view reports instead of rendering
 * an empty outline.
 */
export const parseShowSurveyResult = (result: ToolResult): ParsedResult => {
  const error = getToolError(result);
  if (error) {
    const structured = result.structuredContent;
    const detail = isRecord(structured?.error) ? asString(structured.error.detail) : undefined;
    return { kind: "error", message: detail ?? error };
  }

  const structured = result.structuredContent;
  const survey = readSurvey(structured?.data);
  if (!survey) return { kind: "unreadable" };
  return { kind: "ok", data: { survey, meta: readMeta(result), warnings: readWarnings(structured) } };
};
