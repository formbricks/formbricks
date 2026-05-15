import { TFunction } from "i18next";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { type TSurvey, type TSurveyStyling } from "@formbricks/types/surveys/types";
import {
  buildBlock,
  buildCTAElement,
  buildConsentElement,
  buildMultipleChoiceElement,
  buildNPSElement,
  buildOpenTextElement,
  buildRatingElement,
} from "@/app/lib/survey-block-builder";
import { createI18nString } from "@/lib/i18n/utils";

const fixtureT = ((key: string) => key) as TFunction;

export const EMBED_SURVEY_PREVIEW_SURVEY_ID = "embed-survey-preview-survey";
export const EMBED_SURVEY_PREVIEW_BLOCK_ID = "embed-survey-preview-block";
export const EMBED_SURVEY_PREVIEW_QUESTION_ID = "embed-survey-preview-question";

export const EMBED_SURVEY_PREVIEW_CHOICE_IDS = {
  apples: "embed-survey-preview-choice-apples",
  bananas: "embed-survey-preview-choice-bananas",
  pineapples: "embed-survey-preview-choice-pineapples",
} as const;

export const EMBED_SURVEY_PREVIEW_HEADLINE = "Which fruits do you like";
export const EMBED_SURVEY_PREVIEW_CHOICES = ["Apples", "Bananas", "Pineapples"] as const;
export const EMBED_SURVEY_PREVIEW_SURVEY_URL = "https://app.formbricks.com/s/embed-survey-preview";
export const EMBED_SURVEY_PREVIEW_LOCALE = "en-US";
export const EMBED_SURVEY_PREVIEW_OPEN_TEXT_PLACEHOLDER = "Share your thoughts";
export const EMBED_SURVEY_PREVIEW_ADDRESS_PLACEHOLDERS = {
  addressLine1: "Street address",
  city: "City",
  country: "Country",
} as const;
export const EMBED_SURVEY_PREVIEW_CONTACT_PLACEHOLDERS = {
  firstName: "First name",
  email: "Work email",
  company: "Company",
} as const;
export const EMBED_SURVEY_PREVIEW_MATRIX_ROWS = ["Product quality", "Ease of use"] as const;
export const EMBED_SURVEY_PREVIEW_MATRIX_COLUMNS = ["Poor", "Great"] as const;
export const EMBED_SURVEY_PREVIEW_PICTURE_CHOICES = [
  "https://app.formbricks.com/static/media/powered-by-formbricks.7aec4b1c.svg",
  "https://app.formbricks.com/static/media/powered-by-formbricks.7aec4b1c.svg?variant=2",
] as const;
export const EMBED_SURVEY_PREVIEW_CTA_URL = "https://formbricks.com/docs";

export const EMBED_SURVEY_PREVIEW_STYLING: TSurveyStyling = {
  brandColor: { light: "#22c55e" },
  cardBackgroundColor: { light: "#4a865f" },
  cardBorderColor: { light: "#4a865f" },
  inputColor: { light: "#ffffff" },
  inputBorderColor: { light: "#d6e4dc" },
  questionColor: { light: "#1f2937" },
  roundness: 8,
};

const createChoiceElement = (
  type: TSurveyElementTypeEnum.MultipleChoiceMulti | TSurveyElementTypeEnum.MultipleChoiceSingle
) =>
  buildMultipleChoiceElement({
    id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
    type,
    headline: EMBED_SURVEY_PREVIEW_HEADLINE,
    choices: [...EMBED_SURVEY_PREVIEW_CHOICES],
    choiceIds: [
      EMBED_SURVEY_PREVIEW_CHOICE_IDS.apples,
      EMBED_SURVEY_PREVIEW_CHOICE_IDS.bananas,
      EMBED_SURVEY_PREVIEW_CHOICE_IDS.pineapples,
    ],
    required: true,
    shuffleOption: "none",
  });

const createPreviewSurvey = (element: TSurveyElement): TSurvey =>
  ({
    id: EMBED_SURVEY_PREVIEW_SURVEY_ID,
    name: "Embed Survey Preview",
    type: "link",
    status: "inProgress",
    welcomeCard: {
      enabled: false,
    },
    blocks: [
      buildBlock({
        id: EMBED_SURVEY_PREVIEW_BLOCK_ID,
        name: "Block 1",
        elements: [element],
        buttonLabel: "Next",
        backButtonLabel: "Back",
        t: fixtureT,
      }),
    ],
    endings: [],
    hiddenFields: {
      enabled: false,
    },
    variables: [],
    styling: EMBED_SURVEY_PREVIEW_STYLING,
    surveyClosedMessage: {
      enabled: false,
    },
    isBackButtonHidden: false,
    isAutoProgressingEnabled: false,
    isCaptureIpEnabled: false,
    isVerifyEmailEnabled: false,
    isSingleResponsePerEmailEnabled: false,
  }) as unknown as TSurvey;

const createPreviewElementByType = (type: TSurveyElementTypeEnum): TSurveyElement => {
  switch (type) {
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
      return createChoiceElement(type);
    case TSurveyElementTypeEnum.OpenText:
      return buildOpenTextElement({
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        headline: EMBED_SURVEY_PREVIEW_HEADLINE,
        placeholder: EMBED_SURVEY_PREVIEW_OPEN_TEXT_PLACEHOLDER,
        inputType: "text",
        required: true,
        longAnswer: true,
      });
    case TSurveyElementTypeEnum.Consent:
      return buildConsentElement({
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        headline: EMBED_SURVEY_PREVIEW_HEADLINE,
        subheader: "We need your permission",
        label: "I agree to be contacted",
        required: false,
      });
    case TSurveyElementTypeEnum.NPS:
      return buildNPSElement({
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        headline: EMBED_SURVEY_PREVIEW_HEADLINE,
        lowerLabel: "Not likely",
        upperLabel: "Very likely",
        required: true,
        isColorCodingEnabled: true,
      });
    case TSurveyElementTypeEnum.CTA:
      return buildCTAElement({
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        headline: EMBED_SURVEY_PREVIEW_HEADLINE,
        subheader: "Read more about Formbricks",
        buttonExternal: true,
        ctaButtonLabel: "Open the docs",
        buttonUrl: EMBED_SURVEY_PREVIEW_CTA_URL,
      });
    case TSurveyElementTypeEnum.Rating:
      return buildRatingElement({
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        headline: EMBED_SURVEY_PREVIEW_HEADLINE,
        scale: "number",
        range: 5,
        lowerLabel: "Poor",
        upperLabel: "Great",
        required: true,
        isColorCodingEnabled: true,
      });
    case TSurveyElementTypeEnum.PictureSelection:
      return {
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        type,
        headline: createI18nString(EMBED_SURVEY_PREVIEW_HEADLINE, []),
        required: true,
        allowMulti: false,
        choices: EMBED_SURVEY_PREVIEW_PICTURE_CHOICES.map((imageUrl, index) => ({
          id: `embed-survey-preview-picture-${index + 1}`,
          imageUrl,
        })),
      } as TSurveyElement;
    case TSurveyElementTypeEnum.Cal:
      return {
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        type,
        headline: createI18nString(EMBED_SURVEY_PREVIEW_HEADLINE, []),
        subheader: createI18nString("Book a time with us", []),
        required: false,
        calUserName: "demo-user",
      } as TSurveyElement;
    case TSurveyElementTypeEnum.Date:
      return {
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        type,
        headline: createI18nString(EMBED_SURVEY_PREVIEW_HEADLINE, []),
        required: true,
        format: "M-d-y",
      } as TSurveyElement;
    case TSurveyElementTypeEnum.Matrix:
      return {
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        type,
        headline: createI18nString(EMBED_SURVEY_PREVIEW_HEADLINE, []),
        required: true,
        shuffleOption: "none",
        rows: EMBED_SURVEY_PREVIEW_MATRIX_ROWS.map((label, index) => ({
          id: `embed-survey-preview-row-${index + 1}`,
          label: createI18nString(label, []),
        })),
        columns: EMBED_SURVEY_PREVIEW_MATRIX_COLUMNS.map((label, index) => ({
          id: `embed-survey-preview-column-${index + 1}`,
          label: createI18nString(label, []),
        })),
      } as TSurveyElement;
    case TSurveyElementTypeEnum.Address:
      return {
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        type,
        headline: createI18nString(EMBED_SURVEY_PREVIEW_HEADLINE, []),
        required: true,
        addressLine1: {
          show: true,
          required: true,
          placeholder: createI18nString(EMBED_SURVEY_PREVIEW_ADDRESS_PLACEHOLDERS.addressLine1, []),
        },
        addressLine2: {
          show: false,
          required: false,
          placeholder: createI18nString("Address line 2", []),
        },
        city: {
          show: true,
          required: true,
          placeholder: createI18nString(EMBED_SURVEY_PREVIEW_ADDRESS_PLACEHOLDERS.city, []),
        },
        state: {
          show: false,
          required: false,
          placeholder: createI18nString("State", []),
        },
        zip: {
          show: false,
          required: false,
          placeholder: createI18nString("ZIP code", []),
        },
        country: {
          show: true,
          required: true,
          placeholder: createI18nString(EMBED_SURVEY_PREVIEW_ADDRESS_PLACEHOLDERS.country, []),
        },
      } as TSurveyElement;
    case TSurveyElementTypeEnum.Ranking:
      return {
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        type,
        headline: createI18nString(EMBED_SURVEY_PREVIEW_HEADLINE, []),
        required: true,
        shuffleOption: "none",
        choices: [...EMBED_SURVEY_PREVIEW_CHOICES].map((choice, index) => ({
          id: `embed-survey-preview-ranking-${index + 1}`,
          label: createI18nString(choice, []),
        })),
      } as TSurveyElement;
    case TSurveyElementTypeEnum.ContactInfo:
      return {
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        type,
        headline: createI18nString(EMBED_SURVEY_PREVIEW_HEADLINE, []),
        required: true,
        firstName: {
          show: true,
          required: true,
          placeholder: createI18nString(EMBED_SURVEY_PREVIEW_CONTACT_PLACEHOLDERS.firstName, []),
        },
        lastName: {
          show: false,
          required: false,
          placeholder: createI18nString("Last name", []),
        },
        email: {
          show: true,
          required: true,
          placeholder: createI18nString(EMBED_SURVEY_PREVIEW_CONTACT_PLACEHOLDERS.email, []),
        },
        phone: {
          show: false,
          required: false,
          placeholder: createI18nString("Phone", []),
        },
        company: {
          show: true,
          required: false,
          placeholder: createI18nString(EMBED_SURVEY_PREVIEW_CONTACT_PLACEHOLDERS.company, []),
        },
      } as TSurveyElement;
    case TSurveyElementTypeEnum.FileUpload:
      return {
        id: EMBED_SURVEY_PREVIEW_QUESTION_ID,
        type,
        headline: createI18nString(EMBED_SURVEY_PREVIEW_HEADLINE, []),
        required: true,
        allowMultipleFiles: false,
      } as TSurveyElement;
  }
};

export const createEmbedSurveyPreviewEmailSurvey = (
  type: TSurveyElementTypeEnum = TSurveyElementTypeEnum.MultipleChoiceMulti
): TSurvey => createPreviewSurvey(createPreviewElementByType(type));
