import type { SelectSurveyDecision, SelectSurveyPayload, Survey, UserState, WorkspaceState } from "@/types";

const PROTOCOL_VERSION = 1;
const MS_PER_DAY = 86_400_000;

const decline = (reason: string): SelectSurveyDecision => ({
  v: PROTOCOL_VERSION,
  shouldDisplay: false,
  surveyId: null,
  delaySeconds: null,
  languageCode: null,
  reason,
});

const filterByDisplayType = (surveys: Survey[], userState: UserState): Survey[] => {
  const displays = userState.displays ?? [];
  const responses = userState.responses ?? [];

  return surveys.filter((survey) => {
    switch (survey.displayOption) {
      case "respondMultiple":
        return true;
      case "displayOnce":
        return !displays.some((display) => display.surveyId === survey.id);
      case "displayMultiple":
        return !responses.includes(survey.id);
      case "displaySome": {
        if (typeof survey.displayLimit !== "number") return true;
        if (responses.includes(survey.id)) return false;
        return displays.filter((display) => display.surveyId === survey.id).length < survey.displayLimit;
      }
      default:
        return false;
    }
  });
};

const filterByRecontactDays = (
  surveys: Survey[],
  defaultRecontactDays: number | null | undefined,
  userState: UserState,
  nowMs: number
): Survey[] => {
  const lastDisplayedAtMs = userState.lastDisplayedAtMs;
  if (typeof lastDisplayedAtMs !== "number") return surveys;

  return surveys.filter((survey) => {
    const recontactDays = survey.recontactDays ?? defaultRecontactDays;
    if (typeof recontactDays !== "number") return true;
    const daysSinceLastDisplay = Math.floor((nowMs - lastDisplayedAtMs) / MS_PER_DAY);
    return daysSinceLastDisplay >= recontactDays;
  });
};

const filterBySegments = (surveys: Survey[], userState: UserState): Survey[] => {
  // Anonymous users: only surveys without a segment, or whose segment has no filters.
  if (!userState.userId) {
    return surveys.filter((survey) => !survey.segment || !survey.segment.hasFilters);
  }

  const segments = userState.segments ?? [];
  if (segments.length === 0) return [];

  return surveys.filter((survey) => {
    const segmentId = survey.segment?.id;
    return typeof segmentId === "string" && segments.includes(segmentId);
  });
};

const shouldDisplayBasedOnPercentage = (displayPercentage: number | null | undefined): boolean => {
  if (typeof displayPercentage !== "number") return true;
  const clamped = Math.min(Math.max(displayPercentage, 0), 100);
  return Math.random() * 100 < clamped;
};

// Resolves the language the survey should render in, or null when the survey
// isn't available in the requested language.
export const getLanguageCode = (survey: Survey, language: string | null | undefined): string | null => {
  const availableCodes = (survey.languages ?? []).map((entry) => entry.language.code);

  const raw = language?.toLowerCase() ?? "";
  if (!raw || raw === "default") return "default";

  const selected = (survey.languages ?? []).find(
    (entry) => entry.language.code.toLowerCase() === raw || entry.language.alias?.toLowerCase() === raw
  );

  if (selected?.default) return "default";

  if (!selected || !selected.enabled || !availableCodes.includes(selected.language.code)) {
    return null;
  }

  return selected.language.code;
};

export const selectSurvey = (payload: SelectSurveyPayload): SelectSurveyDecision => {
  const workspaceState: WorkspaceState = payload.workspaceState ?? {};
  const userState: UserState = payload.userState ?? {};
  const nowMs = payload.nowMs ?? Date.now();

  const workspaceData = workspaceState.data?.data;
  const surveys = workspaceData?.surveys ?? [];
  const actionClasses = workspaceData?.actionClasses ?? [];

  const actionClass = actionClasses.find(
    (candidate) => candidate.type === "code" && candidate.key === payload.action
  );
  if (!actionClass) {
    return decline(
      `Action with identifier '${payload.action}' is unknown. Please add this action in Formbricks in order to use it via the SDK action tracking.`
    );
  }

  let eligible = filterByDisplayType(surveys, userState);
  eligible = filterByRecontactDays(eligible, workspaceData?.settings?.recontactDays, userState, nowMs);
  eligible = filterBySegments(eligible, userState);

  const survey = eligible.find((candidate) =>
    (candidate.triggers ?? []).some((trigger) => trigger.actionClass?.name === actionClass.name)
  );
  if (!survey) {
    return decline(`No eligible survey found for action '${payload.action}'.`);
  }

  if (!shouldDisplayBasedOnPercentage(survey.displayPercentage)) {
    return decline(`Skipping survey ${survey.id} due to display percentage restriction.`);
  }

  let languageCode: string | null = "default";
  if ((survey.languages?.length ?? 0) > 1) {
    languageCode = getLanguageCode(survey, payload.language);
    if (!languageCode) {
      return decline(
        `Survey ${survey.id} is not available in language "${payload.language ?? "default"}". Skipping.`
      );
    }
  }

  return {
    v: PROTOCOL_VERSION,
    shouldDisplay: true,
    surveyId: survey.id,
    delaySeconds: survey.delay ?? 0,
    languageCode,
    reason: `Survey ${survey.id} matched action '${payload.action}'.`,
  };
};

export { PROTOCOL_VERSION };
