import type { TFunction } from "i18next";
import { getSurveyFollowUpActionDefaultBody } from "@/modules/survey/editor/lib/utils";
import type { TCreateSurveyFollowUpForm } from "@/modules/survey/editor/types/survey-follow-up";

/**
 * Initial values for the follow-up form.
 *
 * Extracted from `FollowUpModal` so the one invariant that matters here is testable: every field of
 * `ZCreateSurveyFollowUpFormSchema` must come out defined. The schema requires plain booleans for
 * `attachResponseData`, `includeVariables` and `includeHiddenFields`, and the form validates with
 * `mode: "onChange"` — so a field left `undefined` fails the resolver and Save silently does nothing
 * with no visible error. That was the bug in #7218, where `includeVariables` and
 * `includeHiddenFields` were missing from the defaults.
 *
 * The Playwright spec that used to guard it created a follow-up from the editor's empty state, which
 * the Follow-ups deprecation removes wherever Workflows are available — CI included. Creation stays
 * live on self-hosted community, so the guard moves down to a unit test on this function rather than
 * disappearing with the spec.
 */
export const buildFollowUpFormDefaultValues = ({
  defaultValues,
  firstEmailSendToOptionId,
  userEmail,
  t,
}: {
  defaultValues?: Partial<TCreateSurveyFollowUpForm>;
  firstEmailSendToOptionId?: string;
  userEmail: string;
  t: TFunction;
}): TCreateSurveyFollowUpForm => ({
  followUpName: defaultValues?.followUpName ?? "",
  triggerType: defaultValues?.triggerType ?? "response",
  endingIds: defaultValues?.endingIds || null,
  emailTo: defaultValues?.emailTo ?? firstEmailSendToOptionId ?? "",
  replyTo: defaultValues?.replyTo ?? [userEmail],
  subject: defaultValues?.subject ?? t("workspace.surveys.edit.follow_ups_modal_action_subject"),
  body: defaultValues?.body ?? getSurveyFollowUpActionDefaultBody(t),
  attachResponseData: defaultValues?.attachResponseData ?? false,
  includeVariables: defaultValues?.includeVariables ?? false,
  includeHiddenFields: defaultValues?.includeHiddenFields ?? false,
});
