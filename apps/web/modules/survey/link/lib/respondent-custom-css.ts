import "server-only";
import { logger } from "@formbricks/logger";
import type {
  TCustomCssCompiled,
  TCustomCssScope,
  TCustomCssStored,
  TRendererCustomCss,
} from "@formbricks/types/custom-css";
import { toDeliveredCustomCss } from "@/modules/custom-css/lib/delivery";
import { getIsCustomCssRolledOut } from "@/modules/custom-css/lib/rollout";

/**
 * Custom CSS as respondents receive it (ENG-3552), shared by every respondent surface: the SDK
 * environment state (website/app surveys and mobile SDKs) and the link survey page.
 *
 * - Compiled output only. Source, the previous revision and the processor version never leave here.
 * - The rollout flag is asked once per call (one organization), and only when there is CSS at all, so
 *   the common no-CSS workspace costs no flag lookup.
 * - Anything that is not there, withheld or failing is omitted, never sent as an empty or partial
 *   object: the renderer treats a missing scope as "no CSS".
 */

type TStoredCustomCss = TCustomCssStored | null | undefined;

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

const getIsRolledOut = async (organizationId: string): Promise<boolean> => {
  try {
    return await getIsCustomCssRolledOut(organizationId);
  } catch (error) {
    logger.warn({ error, organizationId }, "Custom CSS rollout check failed; withholding custom CSS");
    return false;
  }
};

export const resolveRespondentCustomCss = async ({
  organizationId,
  workspaceCustomCss,
  surveys,
}: {
  organizationId: string;
  workspaceCustomCss: TStoredCustomCss;
  surveys: ReadonlyArray<{ id: string; customCss?: TCustomCssStored | null }>;
}): Promise<TRespondentCustomCss> => {
  const result: TRespondentCustomCss = { surveys: new Map() };
  const surveysWithCss = surveys.filter((survey) => Boolean(survey.customCss));

  if (!workspaceCustomCss && surveysWithCss.length === 0) return result;
  if (!(await getIsRolledOut(organizationId))) return result;

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
  organizationId,
  workspaceCustomCss,
  surveyId,
  surveyCustomCss,
}: {
  organizationId: string;
  workspaceCustomCss: TStoredCustomCss;
  surveyId: string;
  surveyCustomCss: TStoredCustomCss;
}): Promise<TRendererCustomCss | undefined> => {
  const { workspace, surveys } = await resolveRespondentCustomCss({
    organizationId,
    workspaceCustomCss,
    surveys: [{ id: surveyId, customCss: surveyCustomCss }],
  });
  const survey = surveys.get(surveyId);

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
