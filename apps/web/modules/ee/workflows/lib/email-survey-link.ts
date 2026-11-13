import {
  type TWorkflowSendEmailActionConfig,
  type TWorkflowSurveyLinkEmbeddedData,
  WORKFLOW_SURVEY_LINK_TOKEN,
} from "@formbricks/workflows";

/**
 * The Send email panel's survey link (ENG-7180, mock screen 4): which link survey the email carries,
 * the Embedded Data it puts on the link, and where the link goes in the body (`#survey-link#`).
 */

export const hasSurveyLinkToken = (body: string): boolean => body.includes(WORKFLOW_SURVEY_LINK_TOKEN);

/** "Insert survey link": the token as its own paragraph at the end of the body, once. */
export const appendSurveyLinkToken = (body: string): string =>
  hasSurveyLinkToken(body) ? body : `${body}<p>${WORKFLOW_SURVEY_LINK_TOKEN}</p>`;

/** Removing the link takes its token out of the body too, which Enable would otherwise refuse. */
export const removeSurveyLinkToken = (body: string): string =>
  body.replaceAll(`<p>${WORKFLOW_SURVEY_LINK_TOKEN}</p>`, "").replaceAll(WORKFLOW_SURVEY_LINK_TOKEN, "");

/** The config with a link to `surveyId`, keeping the Embedded Data rows already set up. */
export const withSurveyLinkSurvey = (
  config: TWorkflowSendEmailActionConfig,
  surveyId: string
): Pick<TWorkflowSendEmailActionConfig, "surveyLink" | "body"> => ({
  surveyLink: { surveyId, embeddedData: config.surveyLink?.embeddedData ?? [] },
  body: appendSurveyLinkToken(config.body),
});

export const withoutSurveyLink = (
  config: TWorkflowSendEmailActionConfig
): Pick<TWorkflowSendEmailActionConfig, "surveyLink" | "body"> => ({
  surveyLink: undefined,
  body: removeSurveyLinkToken(config.body),
});

export const updateEmbeddedDataRow = (
  rows: readonly TWorkflowSurveyLinkEmbeddedData[],
  index: number,
  update: Partial<TWorkflowSurveyLinkEmbeddedData>
): TWorkflowSurveyLinkEmbeddedData[] => rows.map((row, i) => (i === index ? { ...row, ...update } : row));
