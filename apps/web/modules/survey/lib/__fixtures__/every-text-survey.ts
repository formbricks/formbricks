import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * A survey with every text a respondent can see, in every element type, in two languages (default
 * English, German): the welcome card, block button labels, each element type's own fields, choices,
 * matrix rows and columns, address and contact sub-fields, and both kinds of ending. Shared by the
 * text walker's tests and the Excel export's, which must agree on what a survey's texts are.
 *
 * Only the fields the walkers read are filled; the rest of `TSurvey` is irrelevant to them.
 */
export const EVERY_TEXT_SURVEY = {
  id: "clsurvey0000000000000001",
  name: "Every text",
  welcomeCard: {
    enabled: true,
    headline: { default: "Welcome", de: "Willkommen" },
    subheader: { default: "<p>Glad you are <b>here</b></p>", de: "<p>Schön, dass du <b>da</b> bist</p>" },
    buttonLabel: { default: "Start", de: "Los" },
    timeToFinish: true,
    showResponseCount: false,
  },
  blocks: [
    {
      id: "block-1",
      name: "Block 1",
      buttonLabel: { default: "Next", de: "Weiter" },
      backButtonLabel: { default: "Back", de: "Zurück" },
      elements: [
        {
          id: "open",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "What should we improve?", de: "Was sollen wir verbessern?" },
          subheader: { default: "<p>Be honest</p>", de: "<p>Sei ehrlich</p>" },
          placeholder: { default: "Type here", de: "Hier tippen" },
          imageAltText: { default: "A pencil", de: "Ein Stift" },
          required: true,
          inputType: "text",
          charLimit: { enabled: false },
        },
        {
          id: "single",
          type: TSurveyElementTypeEnum.MultipleChoiceSingle,
          headline: { default: "Pick one", de: "Wähle eins" },
          required: true,
          shuffleOption: "none",
          choices: [
            { id: "yes", label: { default: "Yes", de: "Ja" } },
            { id: "no", label: { default: "No", de: "Nein" } },
            { id: "other", label: { default: "Other", de: "Andere" } },
          ],
          otherOptionPlaceholder: { default: "Say more", de: "Erzähl mehr" },
        },
      ],
    },
    {
      id: "block-2",
      name: "Block 2",
      elements: [
        {
          id: "multi",
          type: TSurveyElementTypeEnum.MultipleChoiceMulti,
          headline: { default: "Pick many", de: "Wähle mehrere" },
          required: false,
          shuffleOption: "none",
          choices: [
            { id: "red", label: { default: "Red", de: "Rot" } },
            { id: "blue", label: { default: "Blue", de: "Blau" } },
          ],
        },
        {
          id: "nps",
          type: TSurveyElementTypeEnum.NPS,
          headline: { default: "Would you recommend us?", de: "Würdest du uns empfehlen?" },
          required: true,
          lowerLabel: { default: "Not likely", de: "Unwahrscheinlich" },
          upperLabel: { default: "Very likely", de: "Sehr wahrscheinlich" },
        },
        {
          id: "cta",
          type: TSurveyElementTypeEnum.CTA,
          headline: { default: "Read our guide", de: "Lies unseren Leitfaden" },
          required: false,
          buttonExternal: true,
          buttonUrl: "https://example.com/guide",
          ctaButtonLabel: { default: "Open guide", de: "Leitfaden öffnen" },
        },
        {
          id: "rating",
          type: TSurveyElementTypeEnum.Rating,
          headline: { default: "Rate us", de: "Bewerte uns" },
          required: true,
          scale: "star",
          range: 5,
          lowerLabel: { default: "Bad", de: "Schlecht" },
          upperLabel: { default: "Great", de: "Toll" },
        },
        {
          id: "consent",
          type: TSurveyElementTypeEnum.Consent,
          headline: { default: "Terms", de: "Bedingungen" },
          required: true,
          label: { default: "I agree", de: "Ich stimme zu" },
        },
        {
          id: "pictures",
          type: TSurveyElementTypeEnum.PictureSelection,
          headline: { default: "Which mug?", de: "Welche Tasse?" },
          required: true,
          allowMulti: false,
          choices: [
            { id: "mug-a", imageUrl: "https://example.com/a.jpg", imageAltText: { default: "Blue mug" } },
            { id: "mug-b", imageUrl: "https://example.com/b.jpg" },
          ],
        },
        {
          id: "date",
          type: TSurveyElementTypeEnum.Date,
          headline: { default: "When?", de: "Wann?" },
          required: true,
          format: "d-M-y",
          html: { default: "<p>Pick a <i>day</i></p>", de: "<p>Wähle einen <i>Tag</i></p>" },
        },
        {
          id: "matrix",
          type: TSurveyElementTypeEnum.Matrix,
          headline: { default: "Rate each", de: "Bewerte jedes" },
          required: true,
          shuffleOption: "none",
          rows: [
            { id: "row-price", label: { default: "Price", de: "Preis" } },
            { id: "row-speed", label: { default: "Speed", de: "Tempo" } },
          ],
          columns: [
            { id: "col-bad", label: { default: "Bad", de: "Schlecht" } },
            { id: "col-good", label: { default: "Good", de: "Gut" } },
          ],
        },
        {
          id: "address",
          type: TSurveyElementTypeEnum.Address,
          headline: { default: "Where do you live?", de: "Wo wohnst du?" },
          required: true,
          addressLine1: { show: true, required: true, placeholder: { default: "Street", de: "Straße" } },
          addressLine2: { show: false, required: false, placeholder: { default: "" } },
          city: { show: true, required: true, placeholder: { default: "City", de: "Stadt" } },
          state: { show: false, required: false, placeholder: { default: "State" } },
          zip: { show: true, required: true, placeholder: { default: "Zip", de: "PLZ" } },
          country: { show: true, required: true, placeholder: { default: "Country", de: "Land" } },
        },
        {
          id: "ranking",
          type: TSurveyElementTypeEnum.Ranking,
          headline: { default: "Rank these", de: "Ordne diese" },
          required: true,
          shuffleOption: "none",
          choices: [
            { id: "speed", label: { default: "Speed", de: "Tempo" } },
            { id: "price", label: { default: "Price", de: "Preis" } },
          ],
        },
        {
          id: "contact",
          type: TSurveyElementTypeEnum.ContactInfo,
          headline: { default: "How do we reach you?", de: "Wie erreichen wir dich?" },
          required: true,
          firstName: { show: true, required: true, placeholder: { default: "First name", de: "Vorname" } },
          lastName: { show: true, required: true, placeholder: { default: "Last name", de: "Nachname" } },
          email: { show: true, required: true, placeholder: { default: "Email", de: "E-Mail" } },
          phone: { show: false, required: false, placeholder: { default: "Phone" } },
          company: { show: false, required: false, placeholder: { default: "Company" } },
        },
        {
          id: "csat",
          type: TSurveyElementTypeEnum.CSAT,
          headline: { default: "How satisfied are you?", de: "Wie zufrieden bist du?" },
          required: true,
          scale: "smiley",
          range: 5,
          lowerLabel: { default: "Unhappy" },
          upperLabel: { default: "Happy" },
        },
        {
          id: "files",
          type: TSurveyElementTypeEnum.FileUpload,
          headline: { default: "Upload a file", de: "Lade eine Datei hoch" },
          required: false,
          allowMultipleFiles: false,
        },
      ],
    },
  ],
  endings: [
    {
      id: "ending-thanks",
      type: "endScreen",
      headline: { default: "Thank you!", de: "Danke!" },
      subheader: { default: "<p>We read every answer</p>", de: "<p>Wir lesen jede Antwort</p>" },
      buttonLabel: { default: "Close", de: "Schließen" },
      buttonLink: "https://example.com",
      imageAltText: { default: "Team waving", de: "Team winkt" },
    },
    { id: "ending-redirect", type: "redirectToUrl", url: "https://example.com", label: "Redirect" },
  ],
  hiddenFields: { enabled: true, fieldIds: [] },
  variables: [],
  languages: [
    {
      language: {
        id: "lang-en",
        code: "en",
        alias: null,
        workspaceId: "ws",
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      default: true,
      enabled: true,
    },
    {
      language: {
        id: "lang-de",
        code: "de",
        alias: null,
        workspaceId: "ws",
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      default: false,
      enabled: true,
    },
  ],
  metadata: {},
} as unknown as TSurvey;
