import "server-only";
import { logger } from "@formbricks/logger";
import type {
  TCustomCssCompiled,
  TCustomCssScope,
  TCustomCssStored,
  TRendererCustomCss,
} from "@formbricks/types/custom-css";
import { toDeliveredCustomCss } from "@/modules/custom-css/lib/delivery";
import { isSurveyCustomCssApplied } from "@/modules/custom-css/lib/survey-css-gate";

/**
 * Custom CSS as respondents receive it (ENG-3552), shared by every respondent surface: the SDK
 * environment state (website/app surveys and mobile SDKs) and the link survey page.
 *
 * - Compiled output only. Source, the previous revision and the processor version never leave here.
 * - A survey's own CSS goes out only while its other style overrides apply (`isSurveyCustomCssApplied`);
 *   the workspace CSS goes out either way.
 * - Anything that is not there, withheld or failing is omitted, never sent as an empty or partial
 *   object: the renderer treats a missing scope as "no CSS".
 */

type TStoredCustomCss = TCustomCssStored | null | undefined;

interface TRespondentSurvey {
  id: string;
  customCss?: TCustomCssStored | null;
  styling?: { overwriteThemeStyling?: boolean | null } | null;
}

export interface TRespondentCustomCss {
  workspace?: TCustomCssCompiled;
  /** Keyed by survey id; surveys without delivered CSS are absent. */
  surveys: Map<string, TCustomCssCompiled>;
}

/** Copies only the compiled fields, and only non-empty ones, so no other key can ride along. */
const toCompiledOnly = (delivered: TCustomCssCompiled | undefined): TCustomCssCompiled | undefined => {
  if (!delivered) return undefined;
  const compiled: TCustomCssCompiled = {};
  if (typeof delivered.light === "string" && delivered.light.trim() !== "") compiled.light = delivered.light;
  if (typeof delivered.dark === "string" && delivered.dark.trim() !== "") compiled.dark = delivered.dark;
  return compiled.light === undefined && compiled.dark === undefined ? undefined : compiled;
};

const deliver = async (
  stored: TStoredCustomCss,
  scope: TCustomCssScope
): Promise<TCustomCssCompiled | undefined> => {
  if (!stored) return undefined;
  try {
    return toCompiledOnly(await toDeliveredCustomCss(stored, scope));
  } catch (error) {
    // Withheld rather than failing the whole response: the survey still renders with built-in styles.
    logger.warn({ error, scope }, "Custom CSS could not be prepared for delivery; withholding it");
    return undefined;
  }
};

export const resolveRespondentCustomCss = async ({
  workspaceCustomCss,
  allowStyleOverwrite,
  surveys,
}: {
  workspaceCustomCss: TStoredCustomCss;
  /** The workspace's "Enable custom styling". */
  allowStyleOverwrite: boolean | null | undefined;
  surveys: ReadonlyArray<TRespondentSurvey>;
}): Promise<TRespondentCustomCss> => {
  const result: TRespondentCustomCss = { surveys: new Map() };
  const surveysWithCss = surveys.filter(
    (survey) =>
      Boolean(survey.customCss) &&
      isSurveyCustomCssApplied({
        allowStyleOverwrite,
        overwriteThemeStyling: survey.styling?.overwriteThemeStyling,
      })
  );

  if (!workspaceCustomCss && surveysWithCss.length === 0) return result;

  const [workspace, ...surveyCss] = await Promise.all([
    deliver(workspaceCustomCss, "workspace"),
    ...surveysWithCss.map((survey) => deliver(survey.customCss, "survey")),
  ]);

  if (workspace) result.workspace = workspace;
  surveysWithCss.forEach((survey, index) => {
    const compiled = surveyCss[index];
    if (compiled) result.surveys.set(survey.id, compiled);
  });

  return result;
};

/**
 * The renderer prop for one link survey, or `undefined` when neither scope has CSS to deliver (the
 * link page then passes nothing and the renderer applies nothing).
 */
export const getLinkSurveyCustomCss = async ({
  workspaceCustomCss,
  allowStyleOverwrite,
  survey: linkSurvey,
}: {
  workspaceCustomCss: TStoredCustomCss;
  allowStyleOverwrite: boolean | null | undefined;
  survey: TRespondentSurvey;
}): Promise<TRendererCustomCss | undefined> => {
  const { workspace, surveys } = await resolveRespondentCustomCss({
    workspaceCustomCss,
    allowStyleOverwrite,
    surveys: [linkSurvey],
  });
  const survey = surveys.get(linkSurvey.id);

  if (!workspace && !survey) return undefined;
  return { ...(workspace ? { workspace } : {}), ...(survey ? { survey } : {}) };
};

/**
 * The survey object a respondent's browser may receive: its stored custom CSS (which carries the
 * editable source) removed. Compiled CSS travels separately, through the renderer's `customCss` prop.
 */
export const omitCustomCssSource = <T extends { customCss?: TCustomCssStored | null }>(
  survey: T
): Omit<T, "customCss"> & { customCss: null } => ({ ...survey, customCss: null });
