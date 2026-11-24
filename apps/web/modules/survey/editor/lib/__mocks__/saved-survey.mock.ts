import { mockSurvey } from "@/app/api/(internal)/pipeline/lib/__mocks__/survey-follow-up.mock";
import type { TSurvey } from "@formbricks/types/surveys/types";

export const SAVED_SURVEY_ID = "clsurvey11111111111111111";
export const SAVED_SURVEY_WORKSPACE_ID = "clwork1111111111111111111";

const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T10:00:00.000Z`);

/**
 * A survey that passes `ZSurvey` and sets every date `SURVEY_JSON_DATES` names, each to a different day,
 * as the editor holds it: with the keys the page renders as `undefined`, which JSON drops.
 */
export const buildSavedSurvey = (overrides: Partial<TSurvey> = {}): TSurvey => ({
  ...mockSurvey,
  id: SAVED_SURVEY_ID,
  workspaceId: SAVED_SURVEY_WORKSPACE_ID,
  status: "draft",
  createdAt: at(1),
  updatedAt: at(2),
  visibilityChangedAt: at(3),
  publishOn: at(20),
  closeOn: at(25),
  archivedAt: null,
  keepEndingCardOpen: undefined,
  autoSelectLanguage: undefined,
  questions: [],
  endings: [],
  hiddenFields: { enabled: true, fieldIds: [] },
  blocks: [
    {
      id: "pa4bl0ckzx9hq2m8tnw3kvjd",
      name: "Block 1",
      elements: [
        {
          id: "feedback",
          type: "openText",
          headline: { default: "What do you think?" },
          required: true,
          inputType: "text",
          charLimit: { enabled: false },
        },
      ],
    },
  ] as TSurvey["blocks"],
  languages: [
    {
      default: true,
      enabled: true,
      language: {
        id: "cllang1111111111111111111",
        code: "en",
        alias: null,
        workspaceId: SAVED_SURVEY_WORKSPACE_ID,
        createdAt: at(4),
        updatedAt: at(5),
      },
    },
  ],
  triggers: [
    {
      actionClass: {
        id: "clacls1111111111111111111",
        name: "New session",
        description: null,
        type: "code",
        key: "new-session",
        noCodeConfig: null,
        workspaceId: SAVED_SURVEY_WORKSPACE_ID,
        createdAt: at(6),
        updatedAt: at(7),
      },
    },
  ],
  segment: {
    id: "clsegm1111111111111111111",
    title: SAVED_SURVEY_ID,
    description: null,
    isPrivate: true,
    filters: [],
    workspaceId: SAVED_SURVEY_WORKSPACE_ID,
    surveys: [SAVED_SURVEY_ID],
    createdAt: at(8),
    updatedAt: at(9),
  },
  followUps: [
    {
      id: "clfoll1111111111111111111",
      name: "Thank you",
      surveyId: SAVED_SURVEY_ID,
      trigger: { type: "response", properties: null },
      action: {
        type: "send-email",
        properties: {
          to: "team@example.com",
          from: "noreply@example.com",
          replyTo: [],
          subject: "Thanks",
          body: "Thanks for your answer",
          attachResponseData: false,
        },
      },
      createdAt: at(10),
      updatedAt: at(11),
    },
  ],
  ...overrides,
});
