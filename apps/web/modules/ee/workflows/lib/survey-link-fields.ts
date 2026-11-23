import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { LINK_SURVEY_SYSTEM_PARAM_KEYS } from "@formbricks/types/surveys/link-survey-params";

/** An Embedded Data field a link survey fills from its link: what the email's link may set. */
export type TSurveyLinkField = { key: string; name: string; dataType: TEmbeddedDataType };

/** A survey's Embedded Data field as `GET /api/v3/surveys/{id}` returns it. */
export type TV3SurveyEmbeddedFieldLike = {
  storageKey: string;
  name: string;
  source: string;
  dataType: TEmbeddedDataType;
};

/**
 * The fields an email's survey link can set, by the rule the server checks (`getWorkflowSurveyLinkSurveys`):
 * the survey's passed-in Embedded Data, by storage key, without a field named like a parameter the link
 * survey reads for itself (`lang`, `userId`, …), which the URL could never fill.
 */
export const getSurveyLinkSettableFields = (
  fields: readonly TV3SurveyEmbeddedFieldLike[]
): TSurveyLinkField[] =>
  fields
    .filter((field) => field.source === "ingested" && !LINK_SURVEY_SYSTEM_PARAM_KEYS.has(field.storageKey))
    .map((field) => ({ key: field.storageKey, name: field.name, dataType: field.dataType }));
