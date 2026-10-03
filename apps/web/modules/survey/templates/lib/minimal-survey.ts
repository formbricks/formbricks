import { TFunction } from "i18next";
import { embeddedFieldsFromLegacyInput } from "@formbricks/types/embedded-data-mapping";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTemplate } from "@formbricks/types/templates";
import { getDefaultEndingCard, getDefaultWelcomeCard } from "@/app/lib/survey-builder";

export const getMinimalSurvey = (t: TFunction): TSurvey => ({
  id: "someUniqueId1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Minimal Survey",
  type: "app",
  workspaceId: "someWorkspaceId1",
  createdBy: null,
  status: "draft",
  visibility: "workspace",
  ownerId: null,
  visibilityVersion: 0,
  visibilityProjectedVersion: 0,
  visibilityChangedAt: null,
  visibilityChangedById: null,
  publishOn: null,
  closeOn: null,
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  recontactDays: null,
  displayLimit: null,
  welcomeCard: getDefaultWelcomeCard(t),
  questions: [],
  blocks: [],
  endings: [getDefaultEndingCard([], t)],
  hiddenFields: {
    enabled: false,
  },
  delay: 0, // No delay
  displayPercentage: null,
  autoComplete: null,
  surveyClosedMessage: {
    enabled: false,
  },
  workspaceOverwrites: null,
  recaptcha: null,
  singleUse: null,
  styling: null,
  segment: null,
  languages: [],
  showLanguageSwitch: false,
  isVerifyEmailEnabled: false,
  variables: [],
  followUps: [],
  isBackButtonHidden: false,
  isAutoProgressingEnabled: true,
  metadata: {},
  slug: null,
  isCaptureIpEnabled: false,
  isAnonymizeResponsesEnabled: false,
});

/**
 * The survey the templates gallery previews for a preset: `getMinimalSurvey()` with the preset
 * merged over it, plus the `embeddedFields` its legacy `variables` / `hiddenFields` describe.
 *
 * A preset has never been written, so no rows exist for it — and every reader, the preview's recall
 * and logic included, reads the rows and nothing else (ENG-2404). This is the input boundary where
 * the preset's legacy keys become the pairs a written survey would carry, so the preview shows the
 * fields a survey created from the template will have.
 */
export const getTemplatePreviewSurvey = (t: TFunction, preset: TTemplate["preset"]): TSurvey => {
  const survey = { ...getMinimalSurvey(t), ...preset };
  return { ...survey, embeddedFields: embeddedFieldsFromLegacyInput(survey) };
};
