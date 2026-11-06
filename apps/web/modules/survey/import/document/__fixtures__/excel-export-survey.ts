import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * A bilingual survey for the Excel export's round trip (ENG-6849): written as an Excel export, it
 * imports back through the document import as a new survey. Only the fields the export reads are
 * filled.
 */
export const EXCEL_EXPORT_ROUND_TRIP_SURVEY = {
  id: "clsurvey0000000000000002",
  name: "Visitor feedback",
  updatedAt: new Date("2026-10-30T12:00:00.000Z"),
  welcomeCard: {
    enabled: true,
    headline: { default: "Welcome", de: "Willkommen" },
    timeToFinish: true,
    showResponseCount: false,
  },
  languages: [
    {
      default: true,
      enabled: true,
      language: {
        id: "lang-en",
        code: "en",
        alias: null,
        workspaceId: "ws",
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    },
    {
      default: false,
      enabled: true,
      language: {
        id: "lang-de",
        code: "de",
        alias: null,
        workspaceId: "ws",
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    },
  ],
  blocks: [
    {
      id: "block-1",
      name: "Block 1",
      elements: [
        {
          id: "visited",
          type: TSurveyElementTypeEnum.MultipleChoiceSingle,
          headline: { default: "Have you visited us before?", de: "Waren Sie schon einmal bei uns?" },
          required: true,
          shuffleOption: "none",
          choices: [
            { id: "yes", label: { default: "Yes", de: "Ja" } },
            { id: "no", label: { default: "No", de: "Nein" } },
          ],
        },
      ],
      logic: [
        {
          id: "clrule000000000000000002",
          conditions: {
            id: "clgroup00000000000000002",
            connector: "and",
            conditions: [
              {
                id: "clcond000000000000000002",
                leftOperand: { type: "element", value: "visited" },
                operator: "equals",
                rightOperand: { type: "static", value: "no" },
              },
            ],
          },
          actions: [{ id: "clact0000000000000000002", objective: "jumpToBlock", target: "block-3" }],
        },
      ],
    },
    {
      id: "block-2",
      name: "Block 2",
      elements: [
        {
          id: "recommend",
          type: TSurveyElementTypeEnum.NPS,
          headline: { default: "Would you recommend us?", de: "Würden Sie uns empfehlen?" },
          required: true,
          lowerLabel: { default: "Not likely", de: "Unwahrscheinlich" },
          upperLabel: { default: "Very likely", de: "Sehr wahrscheinlich" },
        },
      ],
    },
    {
      id: "block-3",
      name: "Block 3",
      elements: [
        {
          id: "improve",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "What should we improve?", de: "Was sollen wir verbessern?" },
          required: false,
          inputType: "text",
          charLimit: { enabled: false },
        },
      ],
    },
  ],
  endings: [
    {
      id: "ending-thanks",
      type: "endScreen",
      headline: { default: "Thank you!", de: "Danke!" },
      subheader: { default: "See you soon.", de: "Bis bald." },
    },
  ],
  hiddenFields: { enabled: true, fieldIds: [] },
  variables: [],
} as unknown as TSurvey;
