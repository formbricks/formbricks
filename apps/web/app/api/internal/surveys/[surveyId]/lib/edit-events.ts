import "server-only";
import type { TSurvey, TSurveyVariable } from "@formbricks/types/surveys/types";
import { capturePostHogEvent } from "@/lib/posthog";

type SurveyEditDiffContext = {
  userId: string;
  surveyId: string;
  organizationId: string;
  workspaceId: string;
};

type TCapture = (event: string, props: Record<string, string | number>) => void;

/** `hidden_field_added`, once for a save that adds any. */
const captureHiddenFieldsAdded = (oldSurvey: TSurvey, newSurvey: TSurvey, capture: TCapture): void => {
  const oldFieldIds = new Set(oldSurvey.hiddenFields?.fieldIds ?? []);
  const newFieldIds = newSurvey.hiddenFields?.fieldIds ?? [];
  if (newFieldIds.some((id) => !oldFieldIds.has(id))) {
    capture("hidden_field_added", { field_count: newFieldIds.length });
  }
};

const blockLogicCount = (block: TSurvey["blocks"][number]): number =>
  (block.logic?.length ?? 0) + (block.logicFallback ? 1 : 0);

/** `conditional_logic_added`, per block that gained a rule or a fallback. */
const captureLogicAdded = (oldSurvey: TSurvey, newSurvey: TSurvey, capture: TCapture): void => {
  const oldBlockLogic = new Map<string, number>(
    (oldSurvey.blocks ?? []).map((block) => [block.id, blockLogicCount(block)])
  );
  for (const block of newSurvey.blocks ?? []) {
    if (blockLogicCount(block) > (oldBlockLogic.get(block.id) ?? 0)) {
      capture("conditional_logic_added", { question_id: block.id });
    }
  }
};

/** `variable_created`, per new variable. */
const captureVariablesCreated = (oldSurvey: TSurvey, newSurvey: TSurvey, capture: TCapture): void => {
  const oldVariableIds = new Set((oldSurvey.variables ?? []).map((v: TSurveyVariable) => v.id));
  for (const variable of newSurvey.variables ?? []) {
    if (!oldVariableIds.has(variable.id)) {
      capture("variable_created", { variable_type: variable.type });
    }
  }
};

/**
 * Per new language: `survey_language_enabled` for the first one a single-language survey gains, and
 * `survey_language_added` for every other, each with how many languages the survey had before it.
 */
const captureLanguagesAdded = (oldSurvey: TSurvey, newSurvey: TSurvey, capture: TCapture): void => {
  const oldLanguages = oldSurvey.languages ?? [];
  const oldLanguageCodes = new Set(oldLanguages.map((l) => l.language.code));
  const addedLanguages = (newSurvey.languages ?? []).filter((l) => !oldLanguageCodes.has(l.language.code));
  const wasMultiLangBefore = oldLanguages.length > 1;

  addedLanguages.forEach((lang, index) => {
    capture(index === 0 && !wasMultiLangBefore ? "survey_language_enabled" : "survey_language_added", {
      language_code: lang.language.code,
      existing_language_count: oldLanguages.length + index,
    });
  });
};

/** `follow_up_added`, per new follow-up that is not being deleted. */
const captureFollowUpsAdded = (oldSurvey: TSurvey, newSurvey: TSurvey, capture: TCapture): void => {
  const oldFollowUpIds = new Set((oldSurvey.followUps ?? []).map((f) => f.id));
  for (const followUp of (newSurvey.followUps ?? []).filter((f) => !f.deleted)) {
    if (!oldFollowUpIds.has(followUp.id)) {
      capture("follow_up_added", { follow_up_id: followUp.id });
    }
  }
};

/**
 * The PostHog events for what an editor save added: hidden fields, conditional logic, variables, languages
 * and follow-ups, each against the survey as it was stored. The same events, with the same properties,
 * as the server actions the save routes replace sent.
 */
export const captureSurveyEditDiffEvents = (
  oldSurvey: TSurvey | null,
  newSurvey: TSurvey,
  context: SurveyEditDiffContext
): void => {
  if (!oldSurvey) return;

  const groupContext = { organizationId: context.organizationId, workspaceId: context.workspaceId };
  const baseProps = {
    organization_id: context.organizationId,
    workspace_id: context.workspaceId,
    survey_id: context.surveyId,
  };
  const capture: TCapture = (event, props) =>
    capturePostHogEvent(context.userId, event, { ...baseProps, ...props }, groupContext);

  captureHiddenFieldsAdded(oldSurvey, newSurvey, capture);
  captureLogicAdded(oldSurvey, newSurvey, capture);
  captureVariablesCreated(oldSurvey, newSurvey, capture);
  captureLanguagesAdded(oldSurvey, newSurvey, capture);
  captureFollowUpsAdded(oldSurvey, newSurvey, capture);
};
