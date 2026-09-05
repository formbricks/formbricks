// Shapes of the state the native shells hand across the bridge. The workspace
// state mirrors the /api/v2/client/{workspaceId}/environment response as cached
// (and re-encoded) by the shells, so every field is optional and the brain must
// stay defensive: an old shell may send less than a new brain expects.

export interface SurveyLanguage {
  language: {
    code: string;
    alias?: string | null;
  };
  default?: boolean;
  enabled?: boolean;
}

export interface SurveyTrigger {
  actionClass?: {
    name?: string | null;
  } | null;
}

export interface SurveySegment {
  id?: string | null;
  hasFilters?: boolean;
}

export interface Survey {
  id: string;
  displayOption?: string | null;
  displayLimit?: number | null;
  displayPercentage?: number | null;
  recontactDays?: number | null;
  delay?: number | null;
  languages?: SurveyLanguage[] | null;
  triggers?: SurveyTrigger[] | null;
  segment?: SurveySegment | null;
}

export interface ActionClass {
  key?: string | null;
  name?: string | null;
  type?: string | null;
}

export interface WorkspaceState {
  data?: {
    data?: {
      surveys?: Survey[] | null;
      actionClasses?: ActionClass[] | null;
      settings?: {
        recontactDays?: number | null;
      } | null;
    } | null;
  } | null;
}

export interface Display {
  surveyId?: string | null;
  createdAt?: string | null;
}

export interface UserState {
  userId?: string | null;
  segments?: string[] | null;
  displays?: Display[] | null;
  responses?: string[] | null;
  lastDisplayedAtMs?: number | null;
}

export interface SelectSurveyPayload {
  action: string;
  workspaceState?: WorkspaceState | null;
  userState?: UserState | null;
  language?: string | null;
  nowMs?: number | null;
}

export interface SelectSurveyDecision {
  v: number;
  shouldDisplay: boolean;
  surveyId: string | null;
  delaySeconds: number | null;
  languageCode: string | null;
  reason: string;
}
