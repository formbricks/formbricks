import { type TOutboundSurvey, isRestrictedSurveyPick } from "@/modules/survey/visibility/lib/outbound";

type TWebhookPickerSurvey = TOutboundSurvey & Readonly<{ name: string }>;

export interface TWebhookSurveyOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * The webhook survey picker's options. With the visibility gate on, a restricted survey cannot be
 * newly picked: it is listed disabled and marked with `restrictedLabel`. One the webhook already uses
 * (`attachedSurveyIds`) stays a normal option so it can be removed.
 */
export const getWebhookSurveyOptions = (
  surveys: ReadonlyArray<TWebhookPickerSurvey>,
  surveyVisibilityEnabled: boolean,
  restrictedLabel: string,
  attachedSurveyIds?: ReadonlyArray<string>
): TWebhookSurveyOption[] =>
  surveys.map((survey) => {
    const isRestrictedPick = isRestrictedSurveyPick(surveyVisibilityEnabled, survey, attachedSurveyIds);
    return {
      value: survey.id,
      label: survey.name,
      ...(isRestrictedPick && { description: restrictedLabel, disabled: true }),
    };
  });

/**
 * Applies the picker's new selection to the stored survey ids. The picker only knows the surveys it
 * lists (the user's visible ones, capped), so an attached id it does not list is kept rather than
 * silently dropped on save.
 */
export const mergePickedSurveyIds = (
  previousSurveyIds: ReadonlyArray<string>,
  pickedSurveyIds: ReadonlyArray<string>,
  listedSurveyIds: ReadonlyArray<string>
): string[] => {
  const listed = new Set(listedSurveyIds);
  return [...previousSurveyIds.filter((id) => !listed.has(id)), ...pickedSurveyIds];
};
