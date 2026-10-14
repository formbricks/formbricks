export const CHECK_PREFIX = "[deployment-check]";

/** Surveys older than this are leftovers of a killed run and are swept at teardown. */
export const STALE_AFTER_MS = 60 * 60 * 1000;

export const OPEN_TEXT_ELEMENT_ID = "dcopentext";
export const RATING_ELEMENT_ID = "dcrating";
export const FILE_ELEMENT_ID = "dcfileupload";
const ENDING_ID = "dcending";

export const surveyName = (label: string, now: Date): string =>
  `${CHECK_PREFIX} ${label} ${now.toISOString()}`;

const baseSurvey = (workspaceId: string, name: string) => ({
  workspaceId,
  name,
  type: "link",
  status: "inProgress",
  defaultLanguage: "en-US",
  endings: [
    {
      id: ENDING_ID,
      type: "endScreen",
      headline: { "en-US": "Deployment check complete" },
    },
  ],
  hiddenFields: { enabled: false },
  variables: [],
});

/** One open-text and one rating question: the smallest survey that proves the response write path. */
export const buildLoopSurvey = (workspaceId: string, now: Date) => ({
  ...baseSurvey(workspaceId, surveyName("survey loop", now)),
  blocks: [
    {
      name: "Check",
      elements: [
        {
          id: OPEN_TEXT_ELEMENT_ID,
          type: "openText",
          headline: { "en-US": "Type the check phrase" },
          required: true,
        },
        {
          id: RATING_ELEMENT_ID,
          type: "rating",
          headline: { "en-US": "Rate this deployment" },
          required: true,
          range: 5,
          scale: "number",
        },
      ],
    },
  ],
});

/** A survey that allows a file upload, which the storage route requires before it signs anything. */
export const buildStorageSurvey = (workspaceId: string, now: Date) => ({
  ...baseSurvey(workspaceId, surveyName("storage", now)),
  blocks: [
    {
      name: "Upload",
      elements: [
        {
          id: FILE_ELEMENT_ID,
          type: "fileUpload",
          headline: { "en-US": "Upload a file" },
          required: false,
          allowMultipleFiles: false,
          allowedFileExtensions: ["png"],
        },
      ],
    },
  ],
});

interface TListedSurvey {
  id: string;
  name: string;
  createdAt: string;
}

/** Surveys this tool created in an earlier run and never cleaned up. Anything without the prefix is left alone. */
export const selectStaleSurveyIds = (
  surveys: readonly TListedSurvey[],
  now: Date,
  alreadyHandled: readonly string[]
): string[] =>
  surveys
    .filter((survey) => survey.name.startsWith(CHECK_PREFIX))
    .filter((survey) => now.getTime() - new Date(survey.createdAt).getTime() > STALE_AFTER_MS)
    .map((survey) => survey.id)
    .filter((id) => !alreadyHandled.includes(id));

/** A 1x1 transparent PNG: the smallest payload the storage tier can round-trip. */
export const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
