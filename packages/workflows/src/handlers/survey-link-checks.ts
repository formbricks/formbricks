import type { TWorkflowTestProblem, TWorkflowWarning } from "../contracts/resources";
import type { TWorkflowExecutableDefinition } from "../types/document";
import type { SurveyLinkSurveyCheck, WorkflowApiContext } from "./context";

export interface SurveyLinkCheckResult {
  /** Links Enable refuses: the survey is not a link survey in this workspace. */
  problems: TWorkflowTestProblem[];
  /** Embedded Data keys the linked survey does not accept; the link survey would drop them. */
  warnings: TWorkflowWarning[];
}

const PROBLEM_BY_STATUS: Record<
  Exclude<SurveyLinkSurveyCheck["status"], "ok">,
  Pick<TWorkflowTestProblem, "code" | "message">
> = {
  not_found: {
    code: "survey_link_survey_not_found",
    message: "The linked survey does not exist in this workspace.",
  },
  not_link: {
    code: "survey_link_survey_not_link",
    message: "The linked survey is not a link survey, so it can't be opened from an email.",
  },
};

/**
 * The checks on `send_email` survey links that need the surveys themselves (ENG-7180), shared by
 * `enable` (problems refuse, warnings ride along) and `testWorkflow` (both reported). The surveys are
 * looked up once for the whole definition, and not at all when no step links one.
 */
export const checkWorkflowSurveyLinks = async (
  definition: TWorkflowExecutableDefinition,
  workspaceId: string,
  ctx: Pick<WorkflowApiContext, "verifySurveyLinkSurveys">
): Promise<SurveyLinkCheckResult> => {
  const links = definition.nodes.flatMap((node, index) => {
    // Only send_email configs carry a survey link.
    const config = node.type === "action" ? node.config : null;
    return config && "surveyLink" in config && config.surveyLink ? [{ index, link: config.surveyLink }] : [];
  });
  const result: SurveyLinkCheckResult = { problems: [], warnings: [] };
  if (links.length === 0) return result;

  const surveyIds = [...new Set(links.map(({ link }) => link.surveyId))];
  const checks = await ctx.verifySurveyLinkSurveys({ workspaceId, surveyIds });
  const checkById = new Map(checks.map((check) => [check.surveyId, check]));

  for (const { index, link } of links) {
    const field = `definition.nodes.${index}.config.surveyLink`;
    const check = checkById.get(link.surveyId);
    const status = check?.status ?? "not_found";
    if (status !== "ok") {
      result.problems.push({ ...PROBLEM_BY_STATUS[status], field: `${field}.surveyId` });
      continue;
    }
    // The link survey matches a URL parameter to a field case-insensitively, so this does too.
    const accepted = new Set(check?.acceptedEmbeddedDataKeys.map((key) => key.toLowerCase()));
    for (const [keyIndex, { key }] of link.embeddedData.entries()) {
      if (accepted.has(key.toLowerCase())) continue;
      result.warnings.push({
        code: "survey_link_key_not_accepted",
        field: `${field}.embeddedData.${keyIndex}.key`,
        message: `The linked survey has no passed-in Embedded Data field ${key}, so the link leaves it off. Add the field to the survey to keep this value.`,
      });
    }
  }
  return result;
};
