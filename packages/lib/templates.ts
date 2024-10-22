import { createId } from "@paralleldrive/cuid2";
import { TActionClass } from "@formbricks/types/action-classes";
import {
  TSurveyCTAQuestion,
  TSurveyCreateInput,
  TSurveyDisplayOption,
  TSurveyEndScreenCard,
  TSurveyHiddenFields,
  TSurveyLanguage,
  TSurveyOpenTextQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyStatus,
  TSurveyType,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { TTemplate } from "@formbricks/types/templates";
import { createI18nString, extractLanguageCodes } from "./i18n/utils";

export const getDefaultEndingCard = (languages: TSurveyLanguage[]): TSurveyEndScreenCard => {
  const languageCodes = extractLanguageCodes(languages);
  return {
    id: createId(),
    type: "endScreen",
    headline: createI18nString("Thank you!", languageCodes),
    subheader: createI18nString("We appreciate your feedback.", languageCodes),
    buttonLabel: createI18nString("Create your own Survey", languageCodes),
    buttonLink: "https://formbricks.com",
  };
};

const hiddenFieldsDefault: TSurveyHiddenFields = {
  enabled: true,
  fieldIds: [],
};

export const welcomeCardDefault: TSurveyWelcomeCard = {
  enabled: false,
  headline: { default: "Welcome!" },
  html: { default: "Thanks for providing your feedback - let's go!" },
  timeToFinish: false,
  showResponseCount: false,
};

export const surveyDefault: TTemplate["preset"] = {
  name: "New Survey",
  welcomeCard: welcomeCardDefault,
  endings: [getDefaultEndingCard([])],
  hiddenFields: hiddenFieldsDefault,
  questions: [],
};

const cartAbandonmentSurvey = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: "Cart Abandonment Survey",
    role: "productManager",
    industries: ["eCommerce"],
    channels: ["app", "website", "link"],
    description: "Understand the reasons behind cart abandonment in your web shop.",
    preset: {
      ...surveyDefault,
      name: "Cart Abandonment Survey",
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We noticed you left some items in your cart. We would love to understand why.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Do you have 2 minutes to help us improve?" },
          required: false,
          buttonLabel: { default: "Sure!" },
          buttonExternal: false,
          dismissButtonLabel: { default: "No, thanks." },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "What was the primary reason you didn't complete your purchase?" },
          subheader: { default: "Please select one of the following options:" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "High shipping costs" },
            },
            {
              id: createId(),
              label: { default: "Found a better price elsewhere" },
            },
            {
              id: createId(),
              label: { default: "Just browsing" },
            },
            {
              id: createId(),
              label: { default: "Decided not to buy" },
            },
            {
              id: createId(),
              label: { default: "Payment issues" },
            },
            { id: "other", label: { default: "Other" } },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: {
            default: "Please elaborate on your reason for not completing the purchase:",
          },
          required: false,
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: "How would you rate your overall shopping experience?" },
          required: true,
          scale: "number",
          range: 5,
          lowerLabel: { default: "Very dissatisfied" },
          upperLabel: { default: "Very satisfied" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: "What factors would encourage you to complete your purchase in the future?",
          },
          subheader: { default: "Please select all that apply:" },
          required: true,
          choices: [
            {
              id: createId(),
              label: { default: "Lower shipping costs" },
            },
            {
              id: createId(),
              label: { default: "Discounts or promotions" },
            },
            {
              id: createId(),
              label: { default: "More payment options" },
            },
            {
              id: createId(),
              label: { default: "Better product descriptions" },
            },
            {
              id: createId(),
              label: { default: "Improved website navigation" },
            },
            { id: "other", label: { default: "Other" } },
          ],
        },
        {
          id: reusableQuestionIds[1],
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          type: TSurveyQuestionTypeEnum.Consent,
          headline: { default: "Would you like to receive a discount code via email?" },
          required: false,
          label: { default: "Yes, please reach out." },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Please share your email address:" },
          required: true,
          inputType: "email",
          longAnswer: false,
          placeholder: { default: "example@email.com" },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Any additional comments or suggestions?" },
          required: false,
          inputType: "text",
        },
      ],
    },
  };
};

const siteAbandonmentSurvey = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: "Site Abandonment Survey",
    role: "productManager",
    industries: ["eCommerce"],
    channels: ["app", "website"],
    description: "Understand the reasons behind site abandonment in your web shop.",
    preset: {
      ...surveyDefault,
      name: "Site Abandonment Survey",
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default:
              "<p class='fb-editor-paragraph' dir='ltr'><span>We noticed you're  leaving our site without making a purchase. We would love to understand why.</span></p>",
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Do you have a minute?" },
          required: false,
          buttonLabel: { default: "Sure!" },
          buttonExternal: false,
          dismissButtonLabel: { default: "No, thanks." },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "What's the primary reason you're leaving our site?" },
          subheader: { default: "Please select one of the following options:" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Can't find what I am looking for" },
            },
            {
              id: createId(),
              label: { default: "Site is too slow" },
            },
            {
              id: createId(),
              label: { default: "Technical issues" },
            },
            {
              id: createId(),
              label: { default: "Just browsing" },
            },
            {
              id: createId(),
              label: { default: "Found a better site" },
            },
            { id: "other", label: { default: "Other" } },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: {
            default: "Please elaborate on your reason for leaving the site:",
          },
          required: false,
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: "How would you rate your overall experience on our site?" },
          required: true,
          scale: "number",
          range: 5,
          lowerLabel: { default: "Very dissatisfied" },
          upperLabel: { default: "Very satisfied" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: "What improvements would encourage you to stay longer on our site?",
          },
          subheader: { default: "Please select all that apply:" },
          required: true,
          choices: [
            {
              id: createId(),
              label: { default: "Faster loading times" },
            },
            {
              id: createId(),
              label: { default: "Better product search functionality" },
            },
            {
              id: createId(),
              label: { default: "More product variety" },
            },
            {
              id: createId(),
              label: { default: "Improved site design" },
            },
            {
              id: createId(),
              label: { default: "More customer reviews" },
            },
            { id: "other", label: { default: "Other" } },
          ],
        },
        {
          id: reusableQuestionIds[1],
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          type: TSurveyQuestionTypeEnum.Consent,
          headline: { default: "Would you like to receive updates about new products and promotions?" },
          required: false,
          label: { default: "Yes, please reach out." },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Please share your email address:" },
          required: true,
          inputType: "email",
          longAnswer: false,
          placeholder: { default: "example@email.com" },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Any additional comments or suggestions?" },
          required: false,
          inputType: "text",
        },
      ],
    },
  };
};

const productMarketFitSuperhuman = (): TTemplate => {
  const reusableQuestionIds = [createId()];

  return {
    name: "Product Market Fit (Superhuman)",
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: "Measure PMF by assessing how disappointed users would be if your product disappeared.",
    preset: {
      ...surveyDefault,
      name: "Product Market Fit (Superhuman)",
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We would love to understand your user experience better. Sharing your insight helps a lot.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "You are one of our power users! Do you have 5 minutes?" },
          required: false,
          buttonLabel: { default: "Happy to help!" },
          buttonExternal: false,
          dismissButtonLabel: { default: "No, thanks." },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How disappointed would you be if you could no longer use {{productName}}?" },
          subheader: { default: "Please select one of the following options:" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Not at all disappointed" },
            },
            {
              id: createId(),
              label: { default: "Somewhat disappointed" },
            },
            {
              id: createId(),
              label: { default: "Very disappointed" },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "What is your role?" },
          subheader: { default: "Please select one of the following options:" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Founder" },
            },
            {
              id: createId(),
              label: { default: "Executive" },
            },
            {
              id: createId(),
              label: { default: "Product Manager" },
            },
            {
              id: createId(),
              label: { default: "Product Owner" },
            },
            {
              id: createId(),
              label: { default: "Software Engineer" },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What type of people do you think would most benefit from {{productName}}?" },
          required: true,
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What is the main benefit you receive from {{productName}}?" },
          required: true,
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "How can we improve {{productName}} for you?" },
          subheader: { default: "Please be as specific as possible." },
          required: true,
          inputType: "text",
        },
      ],
    },
  };
};

const onboardingSegmentation = (): TTemplate => {
  return {
    name: "Onboarding Segmentation",
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: "Learn more about who signed up to your product and why.",
    preset: {
      ...surveyDefault,
      name: "Onboarding Segmentation",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "What is your role?" },
          subheader: { default: "Please select one of the following options:" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Founder" },
            },
            {
              id: createId(),
              label: { default: "Executive" },
            },
            {
              id: createId(),
              label: { default: "Product Manager" },
            },
            {
              id: createId(),
              label: { default: "Product Owner" },
            },
            {
              id: createId(),
              label: { default: "Software Engineer" },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "What's your company size?" },
          subheader: { default: "Please select one of the following options:" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "only me" },
            },
            {
              id: createId(),
              label: { default: "1-5 employees" },
            },
            {
              id: createId(),
              label: { default: "6-10 employees" },
            },
            {
              id: createId(),
              label: { default: "11-100 employees" },
            },
            {
              id: createId(),
              label: { default: "over 100 employees" },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How did you hear about us first?" },
          subheader: { default: "Please select one of the following options:" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Recommendation" },
            },
            {
              id: createId(),
              label: { default: "Social Media" },
            },
            {
              id: createId(),
              label: { default: "Ads" },
            },
            {
              id: createId(),
              label: { default: "Google Search" },
            },
            {
              id: createId(),
              label: { default: "In a Podcast" },
            },
          ],
        },
      ],
    },
  };
};

const churnSurvey = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];

  return {
    name: "Churn Survey",
    role: "sales",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link"],
    description: "Find out why people cancel their subscriptions. These insights are pure gold!",
    preset: {
      ...surveyDefault,
      name: "Churn Survey",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[4],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          choices: [
            { id: reusableOptionIds[0], label: { default: "Difficult to use" } },
            { id: reusableOptionIds[1], label: { default: "It's too expensive" } },
            { id: reusableOptionIds[2], label: { default: "I am missing features" } },
            { id: reusableOptionIds[3], label: { default: "Poor customer service" } },
            { id: reusableOptionIds[4], label: { default: "I just didn't need it anymore" } },
          ],
          headline: { default: "Why did you cancel your subscription?" },
          required: true,
          subheader: { default: "We're sorry to see you leave. Help us do better:" },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "What would have made {{productName}} easier to use?" },
          required: true,
          buttonLabel: { default: "Send" },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We\'d love to keep you as a customer. Happy to offer a 30% discount for the next year.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isClicked",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Get 30% off for the next year!" },
          required: true,
          buttonUrl: "https://formbricks.com",
          buttonLabel: { default: "Get 30% off" },
          buttonExternal: true,
          dismissButtonLabel: { default: "Skip" },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "What features are you missing?" },
          required: true,
          inputType: "text",
        },
        {
          id: reusableQuestionIds[4],
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We aim to provide the best possible customer service. Please email our CEO and she will personally handle your issue.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isClicked",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "So sorry to hear 😔 Talk to our CEO directly!" },
          required: true,
          buttonUrl: "mailto:ceo@company.com",
          buttonLabel: { default: "Send email to CEO" },
          buttonExternal: true,
          dismissButtonLabel: { default: "Skip" },
        },
      ],
    },
  };
};

const earnedAdvocacyScore = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId()];

  return {
    name: "Earned Advocacy Score (EAS)",
    role: "customerSuccess",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link"],
    description:
      "The EAS is a riff off the NPS but asking for actual past behaviour instead of lofty intentions.",
    preset: {
      ...surveyDefault,
      name: "Earned Advocacy Score (EAS)",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          shuffleOption: "none",
          choices: [
            { id: reusableOptionIds[0], label: { default: "Yes" } },
            { id: reusableOptionIds[1], label: { default: "No" } },
          ],
          headline: { default: "Have you actively recommended {{productName}} to others?" },
          required: true,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          headline: { default: "Great to hear! Why did you recommend us?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "So sad. Why not?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          shuffleOption: "none",
          choices: [
            { id: reusableOptionIds[2], label: { default: "Yes" } },
            { id: reusableOptionIds[3], label: { default: "No" } },
          ],
          headline: { default: "Have you actively discouraged others from choosing {{productName}}?" },
          required: true,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What made you discourage them?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const improveTrialConversion = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];

  return {
    name: "Improve Trial Conversion",
    role: "sales",
    industries: ["saas"],
    channels: ["link", "app"],
    description: "Find out why people stopped their trial. These insights help you improve your funnel.",
    preset: {
      ...surveyDefault,
      name: "Improve Trial Conversion",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[4],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          choices: [
            { id: reusableOptionIds[0], label: { default: "I didn't get much value out of it" } },
            { id: reusableOptionIds[1], label: { default: "I expected something else" } },
            { id: reusableOptionIds[2], label: { default: "It's too expensive for what it does" } },
            { id: reusableOptionIds[3], label: { default: "I am missing a feature" } },
            { id: reusableOptionIds[4], label: { default: "I was just looking around" } },
          ],
          headline: { default: "Why did you stop your trial?" },
          required: true,
          subheader: { default: "Help us understand you better:" },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
          ],
          headline: { default: "Sorry to hear. What was the biggest problem using {{productName}}?" },
          required: true,
          buttonLabel: { default: "Next" },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
          ],
          headline: { default: "What did you expect {{productName}} would do for you?" },
          required: true,
          buttonLabel: { default: "Next" },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[3],
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We\'re happy to offer you a 20% discount on a yearly plan.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isClicked",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Sorry to hear! Get 20% off the first year." },
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: { default: "Get 20% off" },
          buttonExternal: true,
          dismissButtonLabel: { default: "Skip" },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
          ],
          headline: { default: "Which features are you missing?" },
          required: true,
          subheader: { default: "What would you like to achieve?" },
          buttonLabel: { default: "Next" },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[5],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[5],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "How are you solving your problem now?" },
          required: false,
          subheader: { default: "Please name alternative solutions:" },
          inputType: "text",
        },
      ],
    },
  };
};

const reviewPrompt = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: "Review Prompt",
    role: "marketing",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link", "app"],
    description: "Invite users who love your product to review it publicly.",
    preset: {
      ...surveyDefault,
      name: "Review Prompt",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isLessThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 3,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "star",
          headline: { default: "How do you like {{productName}}?" },
          required: true,
          lowerLabel: { default: "Not good" },
          upperLabel: { default: "Very satisfied" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[1],
          html: { default: '<p class="fb-editor-paragraph" dir="ltr"><span>This helps us a lot.</span></p>' },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isClicked",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Happy to hear 🙏 Please write a review for us!" },
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: { default: "Write review" },
          buttonExternal: true,
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Sorry to hear! What is ONE thing we can do better?" },
          required: true,
          subheader: { default: "Help us improve your experience." },
          buttonLabel: { default: "Send" },
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const interviewPrompt = (): TTemplate => {
  return {
    name: "Interview Prompt",
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: "Invite a specific subset of your users to schedule an interview with your product team.",
    preset: {
      ...surveyDefault,
      name: "Interview Prompt",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: "Do you have 15 min to talk to us? 🙏" },
          html: { default: "You're one of our power users. We would love to interview you briefly!" },
          buttonLabel: { default: "Book slot" },
          buttonUrl: "https://cal.com/johannes",
          buttonExternal: true,
          required: false,
        },
      ],
    },
  };
};

const improveActivationRate = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];

  return {
    name: "Improve Activation Rate",
    role: "productManager",
    industries: ["saas"],
    channels: ["link"],
    description: "Identify weaknesses in your onboarding flow to increase user activation.",
    preset: {
      ...surveyDefault,
      name: "Onboarding Drop-Off Reasons",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[4],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
          ],
          choices: [
            { id: reusableOptionIds[0], label: { default: "Didn't seem useful to me" } },
            { id: reusableOptionIds[1], label: { default: "Difficult to set up or use" } },
            { id: reusableOptionIds[2], label: { default: "Lacked features/functionality" } },
            { id: reusableOptionIds[3], label: { default: "Just haven't had the time" } },
            { id: reusableOptionIds[4], label: { default: "Something else" } },
          ],
          headline: {
            default: "What's the main reason why you haven't finished setting up {{productName}}?",
          },
          required: true,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "What made you think {{productName}} wouldn't be useful?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "What was difficult about setting up or using {{productName}}?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "What features or functionality were missing?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "How could we make it easier for you to get started?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [],
          headline: { default: "What was it? Please explain:" },
          required: false,
          subheader: { default: "We're eager to fix it asap." },
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const employeeSatisfaction = (): TTemplate => {
  return {
    name: "Employee Satisfaction",
    role: "productManager",
    industries: ["saas", "other"],
    channels: ["app", "link"],
    description: "Gauge employee satisfaction and identify areas for improvement.",
    preset: {
      ...surveyDefault,
      name: "Employee Satisfaction",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "star",
          headline: { default: "How satisfied are you with your current role?" },
          required: true,
          lowerLabel: { default: "Not satisfied" },
          upperLabel: { default: "Very satisfied" },
          isColorCodingEnabled: true,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: "Extremely meaningful" } },
            { id: createId(), label: { default: "Very meaningful" } },
            { id: createId(), label: { default: "Moderately meaningful" } },
            { id: createId(), label: { default: "Slightly meaningful" } },
            { id: createId(), label: { default: "Not at all meaningful" } },
          ],
          headline: { default: "How meaningful do you find your work?" },
          required: true,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What do you enjoy most about working here?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: "Extremely well" } },
            { id: createId(), label: { default: "Very well" } },
            { id: createId(), label: { default: "Moderately well" } },
            { id: createId(), label: { default: "Slightly well" } },
            { id: createId(), label: { default: "Not at all well" } },
          ],
          headline: { default: "How well do you feel your work is recognized?" },
          required: true,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: { default: "Rate the support you receive from your manager." },
          required: true,
          lowerLabel: { default: "Poor" },
          upperLabel: { default: "Excellent" },
          isColorCodingEnabled: true,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What improvements would you suggest for our workplace?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: "Extremely likely" } },
            { id: createId(), label: { default: "Very likely" } },
            { id: createId(), label: { default: "Moderately likely" } },
            { id: createId(), label: { default: "Slightly likely" } },
            { id: createId(), label: { default: "Not at all likely" } },
          ],
          headline: { default: "How likely are you to recommend our company to a friend?" },
          required: true,
        },
      ],
    },
  };
};

const uncoverStrengthsAndWeaknesses = (): TTemplate => {
  return {
    name: "Uncover Strengths & Weaknesses",
    role: "productManager",
    industries: ["saas", "other"],
    channels: ["app", "link"],
    description: "Find out what users like and don't like about your product or offering.",
    preset: {
      ...surveyDefault,
      name: "Uncover Strengths & Weaknesses",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: "Ease of use" } },
            { id: createId(), label: { default: "Good value for money" } },
            { id: createId(), label: { default: "It's open-source" } },
            { id: createId(), label: { default: "The founders are cute" } },
            { id: "other", label: { default: "Other" } },
          ],
          headline: { default: "What do you value most about {{productName}}?" },
          required: true,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: "Documentation" } },
            { id: createId(), label: { default: "Customizability" } },
            { id: createId(), label: { default: "Pricing" } },
            { id: "other", label: { default: "Other" } },
          ],
          headline: { default: "What should we improve on?" },
          required: true,
          subheader: { default: "Please select one of the following options:" },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Would you like to add something?" },
          required: false,
          subheader: { default: "Feel free to speak your mind, we do too." },
          inputType: "text",
        },
      ],
    },
  };
};

const productMarketFitShort = (): TTemplate => {
  return {
    name: "Product Market Fit Survey (Short)",
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: "Measure PMF by assessing how disappointed users would be if your product disappeared.",
    preset: {
      ...surveyDefault,
      name: "Product Market Fit Survey (Short)",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How disappointed would you be if you could no longer use {{productName}}?" },
          subheader: { default: "Please select one of the following options:" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Not at all disappointed" },
            },
            {
              id: createId(),
              label: { default: "Somewhat disappointed" },
            },
            {
              id: createId(),
              label: { default: "Very disappointed" },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "How can we improve {{productName}} for you?" },
          subheader: { default: "Please be as specific as possible." },
          required: true,
          inputType: "text",
        },
      ],
    },
  };
};

const marketAttribution = (): TTemplate => {
  return {
    name: "Marketing Attribution",
    role: "marketing",
    industries: ["saas", "eCommerce"],
    channels: ["website", "app", "link"],
    description: "How did you first hear about us?",
    preset: {
      ...surveyDefault,
      name: "Marketing Attribution",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How did you hear about us first?" },
          subheader: { default: "Please select one of the following options:" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Recommendation" },
            },
            {
              id: createId(),
              label: { default: "Social Media" },
            },
            {
              id: createId(),
              label: { default: "Ads" },
            },
            {
              id: createId(),
              label: { default: "Google Search" },
            },
            {
              id: createId(),
              label: { default: "In a Podcast" },
            },
          ],
        },
      ],
    },
  };
};

const changingSubscriptionExperience = (): TTemplate => {
  return {
    name: "Changing Subscription Experience",
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: "Find out what goes through peoples minds when changing their subscriptions.",
    preset: {
      ...surveyDefault,
      name: "Changing subscription experience",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How easy was it to change your plan?" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Extremely difficult" },
            },
            {
              id: createId(),
              label: { default: "It took a while, but I got it" },
            },
            {
              id: createId(),
              label: { default: "It was alright" },
            },
            {
              id: createId(),
              label: { default: "Quite easy" },
            },
            {
              id: createId(),
              label: { default: "Very easy, love it!" },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "Is the pricing information easy to understand?" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Yes, very clear." },
            },
            {
              id: createId(),
              label: { default: "I was confused at first, but found what I needed." },
            },
            {
              id: createId(),
              label: { default: "Quite complicated." },
            },
          ],
        },
      ],
    },
  };
};

const identifyCustomerGoals = (): TTemplate => {
  return {
    name: "Identify Customer Goals",
    role: "productManager",
    industries: ["saas", "other"],
    channels: ["app", "website"],
    description:
      "Better understand if your messaging creates the right expectations of the value your product provides.",
    preset: {
      ...surveyDefault,
      name: "Identify Customer Goals",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "What's your primary goal for using {{productName}}?" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Understand my user base deeply" },
            },
            {
              id: createId(),
              label: { default: "Identify upselling opportunities" },
            },
            {
              id: createId(),
              label: { default: "Build the best possible product" },
            },
            {
              id: createId(),
              label: { default: "Rule the world to make everyone breakfast brussels sprouts." },
            },
          ],
        },
      ],
    },
  };
};

const featureChaser = (): TTemplate => {
  return {
    name: "Feature Chaser",
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: "Follow up with users who just used a specific feature.",
    preset: {
      ...surveyDefault,
      name: "Feature Chaser",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: { default: "How important is [ADD FEATURE] for you?" },
          required: true,
          lowerLabel: { default: "Not important" },
          upperLabel: { default: "Very important" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: "Aspect 1" } },
            { id: createId(), label: { default: "Aspect 2" } },
            { id: createId(), label: { default: "Aspect 3" } },
            { id: createId(), label: { default: "Aspect 4" } },
          ],
          headline: { default: "Which aspect is most important?" },
          required: true,
        },
      ],
    },
  };
};

const fakeDoorFollowUp = (): TTemplate => {
  return {
    name: "Fake Door Follow-Up",
    role: "productManager",
    industries: ["saas", "eCommerce"],
    channels: ["app", "website"],
    description: "Follow up with users who ran into one of your Fake Door experiments.",
    preset: {
      ...surveyDefault,
      name: "Fake Door Follow-Up",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: "How important is this feature for you?" },
          required: true,
          lowerLabel: { default: "Not important" },
          upperLabel: { default: "Very important" },
          range: 5,
          scale: "number",
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: { default: "What should be definitely include building this?" },
          required: false,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Aspect 1" },
            },
            {
              id: createId(),
              label: { default: "Aspect 2" },
            },
            {
              id: createId(),
              label: { default: "Aspect 3" },
            },
            {
              id: createId(),
              label: { default: "Aspect 4" },
            },
          ],
        },
      ],
    },
  };
};

const feedbackBox = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId()];

  return {
    name: "Feedback Box",
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: "Give your users the chance to seamlessly share what's on their minds.",
    preset: {
      ...surveyDefault,
      name: "Feedback Box",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",

          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          choices: [
            { id: reusableOptionIds[0], label: { default: "Bug report 🐞" } },
            { id: reusableOptionIds[1], label: { default: "Feature Request 💡" } },
          ],
          headline: { default: "What's on your mind, boss?" },
          required: true,
          subheader: { default: "Thanks for sharing. We'll get back to you asap." },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          headline: { default: "What's broken?" },
          required: true,
          subheader: { default: "The more detail, the better :)" },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We will fix this as soon as possible. Do you want to be notified when we did?</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isClicked",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Want to stay in the loop?" },
          required: false,
          buttonLabel: { default: "Yes, notify me" },
          buttonExternal: false,
          dismissButtonLabel: { default: "No, thanks" },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Lovely, tell us more!" },
          required: true,
          subheader: { default: "What problem do you want us to solve?" },
          buttonLabel: { default: "Request feature" },
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const integrationSetupSurvey = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: "Integration Setup Survey",
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: "Evaluate how easily users can add integrations to your product. Find blind spots.",
    preset: {
      ...surveyDefault,
      name: "Integration Usage Survey",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: "How easy was it to set this integration up?" },
          required: true,
          lowerLabel: { default: "Not easy" },
          upperLabel: { default: "Very easy" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Why was it hard?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What other tools would you like to use with {{productName}}?" },
          required: false,
          subheader: { default: "We keep building integrations, yours can be next:" },
          inputType: "text",
        },
      ],
    },
  };
};

const newIntegrationSurvey = (): TTemplate => {
  return {
    name: "New Integration Survey",
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: "Find out which integrations your users would like to see next.",
    preset: {
      ...surveyDefault,
      name: "New Integration Survey",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "Which other tools are you using?" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "PostHog" },
            },
            {
              id: createId(),
              label: { default: "Segment" },
            },
            {
              id: createId(),
              label: { default: "Hubspot" },
            },
            {
              id: createId(),
              label: { default: "Twilio" },
            },
            {
              id: "other",
              label: { default: "Other" },
            },
          ],
        },
      ],
    },
  };
};

const docsFeedback = (): TTemplate => {
  return {
    name: "Docs Feedback",
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "website", "link"],
    description: "Measure how clear each page of your developer documentation is.",
    preset: {
      ...surveyDefault,
      name: "{{productName}} Docs Feedback",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "Was this page helpful?" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Yes 👍" },
            },
            {
              id: createId(),
              label: { default: "No 👎" },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Please elaborate:" },
          required: false,
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Page URL" },
          required: false,
          inputType: "text",
        },
      ],
    },
  };
};

const NPS = (): TTemplate => {
  return {
    name: "Net Promoter Score (NPS)",
    role: "customerSuccess",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link", "website"],
    description: "Measure the Net Promoter Score of your product or service.",
    preset: {
      ...surveyDefault,
      name: "NPS Survey",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.NPS,
          headline: { default: "How likely are you to recommend {{productName}} to a friend or colleague?" },
          required: false,
          lowerLabel: { default: "Not likely" },
          upperLabel: { default: "Very likely" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What made you give that rating?" },
          required: false,
          inputType: "text",
        },
      ],
    },
  };
};

const customerSatisfactionScore = (): TTemplate => {
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  return {
    name: "Customer Satisfaction Score (CSAT)",
    role: "customerSuccess",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link", "website"],
    description: "Measure the Customer Satisfaction Score of your product or service.",
    preset: {
      ...surveyDefault,
      name: "{{productName}} CSAT",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          range: 10,
          scale: "number",
          headline: {
            default:
              "How likely is it that you would recommend this {{productName}} to a friend or colleague?",
          },
          required: true,
          lowerLabel: { default: "Not satisfied" },
          upperLabel: { default: "Very satisfied" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "Overall, how satisfied or dissatisfied are you with our {{productName}}" },
          subheader: { default: "Please select one:" },
          required: true,
          choices: [
            { id: createId(), label: { default: "Very satisfied" } },
            { id: createId(), label: { default: "Somewhat satisfied" } },
            { id: createId(), label: { default: "Neither satisfied nor dissatisfied" } },
            { id: createId(), label: { default: "Somewhat dissatisfied" } },
            { id: createId(), label: { default: "Very dissatisfied" } },
          ],
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: "Which of the following words would you use to describe our {{productName}}?",
          },
          subheader: { default: "Select all that apply:" },
          required: true,
          choices: [
            { id: createId(), label: { default: "Reliable" } },
            { id: createId(), label: { default: "High quality" } },
            { id: createId(), label: { default: "Overpriced" } },
            { id: createId(), label: { default: "Impractical" } },
            { id: createId(), label: { default: "Useful" } },
            { id: createId(), label: { default: "Ineffective" } },
            { id: createId(), label: { default: "Unique" } },
            { id: createId(), label: { default: "Poor quality" } },
            { id: createId(), label: { default: "Good value for money" } },
            { id: createId(), label: { default: "Unreliable" } },
          ],
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How well do our {{productName}} meet your needs?" },
          subheader: { default: "Select one option:" },
          required: true,
          choices: [
            { id: createId(), label: { default: "Extremely well" } },
            { id: createId(), label: { default: "Very well" } },
            { id: createId(), label: { default: "Somewhat well" } },
            { id: createId(), label: { default: "Not so well" } },
            { id: createId(), label: { default: "Not at all well" } },
          ],
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How would you rate the quality of the {{productName}}?" },
          subheader: { default: "Select one option:" },
          required: true,
          choices: [
            { id: createId(), label: { default: "Very high quality" } },
            { id: createId(), label: { default: "High quality" } },
            { id: createId(), label: { default: "Low quality" } },
            { id: createId(), label: { default: "Very low quality" } },
            { id: createId(), label: { default: "Neither high nor low" } },
          ],
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How would you rate the value for money of the {{productName}}?" },
          subheader: { default: "Please select one:" },
          required: true,
          choices: [
            { id: createId(), label: { default: "Excellent" } },
            { id: createId(), label: { default: "Above average" } },
            { id: createId(), label: { default: "Average" } },
            { id: createId(), label: { default: "Below average" } },
            { id: createId(), label: { default: "Poor" } },
          ],
        },
        {
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How responsive have we been to your questions about our services?" },
          subheader: { default: "Select one option:" },
          required: true,
          choices: [
            { id: createId(), label: { default: "Extremely responsive" } },
            { id: createId(), label: { default: "Very responsive" } },
            { id: createId(), label: { default: "Somewhat responsive" } },
            { id: createId(), label: { default: "Not so responsive" } },
            { id: createId(), label: { default: "Not at all responsive" } },
            { id: createId(), label: { default: "Not applicable" } },
          ],
        },
        {
          id: reusableQuestionIds[7],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How long have you been a customer of {{productName}}?" },
          subheader: { default: "Select one option:" },
          required: true,
          choices: [
            { id: createId(), label: { default: "This is my first purchase" } },
            { id: createId(), label: { default: "Less than six months" } },
            { id: createId(), label: { default: "Six months to a year" } },
            { id: createId(), label: { default: "1 - 2 years" } },
            { id: createId(), label: { default: "3 or more years" } },
            { id: createId(), label: { default: "I haven't made a purchase yet" } },
          ],
        },
        {
          id: reusableQuestionIds[8],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How likely are you to purchase any of our {{productName}} again ?" },
          subheader: { default: "Select one option:" },
          required: true,
          choices: [
            { id: createId(), label: { default: "Extremely likely" } },
            { id: createId(), label: { default: "Very likely" } },
            { id: createId(), label: { default: "Somewhat likely" } },
            { id: createId(), label: { default: "Not so likely" } },
            { id: createId(), label: { default: "Not at all likely" } },
          ],
        },
        {
          id: reusableQuestionIds[9],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Do you have any other comments, questions or concerns?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const collectFeedback = (): TTemplate => {
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  return {
    name: "Collect Feedback",
    role: "productManager",
    industries: ["other", "eCommerce"],
    channels: ["website", "link"],
    description: "Gather comprehensive feedback on your product or service.",
    preset: {
      ...surveyDefault,
      name: "Feedback Survey",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isLessThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 3,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "star",
          headline: { default: "How do you rate your overall experience?" },
          required: true,
          subheader: { default: "Don't worry, be honest." },
          lowerLabel: { default: "Not good" },
          upperLabel: { default: "Very good" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          headline: { default: "Lovely! What did you like about it?" },
          required: true,
          longAnswer: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Thanks for sharing! What did you not like?" },
          required: true,
          longAnswer: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "smiley",
          headline: { default: "How do you rate our communication?" },
          required: true,
          lowerLabel: { default: "Not good" },
          upperLabel: { default: "Very good" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Anything else you'd like to share with our team?" },
          required: false,
          longAnswer: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          choices: [
            { id: createId(), label: { default: "Google" } },
            { id: createId(), label: { default: "Social Media" } },
            { id: createId(), label: { default: "Friends" } },
            { id: createId(), label: { default: "Podcast" } },
            { id: "other", label: { default: "Other" } },
          ],
          headline: { default: "How did you hear about us?" },
          required: true,
          shuffleOption: "none",
        },
        {
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Lastly, we'd love to respond to your feedback. Please share your email:" },
          required: false,
          inputType: "email",
          longAnswer: false,
          placeholder: { default: "example@email.com" },
        },
      ],
    },
  };
};

const identifyUpsellOpportunities = (): TTemplate => {
  return {
    name: "Identify Upsell Opportunities",
    role: "sales",
    industries: ["saas"],
    channels: ["app", "link"],
    description: "Find out how much time your product saves your user. Use it to upsell.",
    preset: {
      ...surveyDefault,
      name: "Identify upsell opportunities",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "How many hours does your team save per week by using {{productName}}?" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Less than 1 hour" },
            },
            {
              id: createId(),
              label: { default: "1 to 2 hours" },
            },
            {
              id: createId(),
              label: { default: "3 to 5 hours" },
            },
            {
              id: createId(),
              label: { default: "5+ hours" },
            },
          ],
        },
      ],
    },
  };
};

const prioritizeFeatures = (): TTemplate => {
  return {
    name: "Prioritize Features",
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: "Identify features your users need most and least.",
    preset: {
      ...surveyDefault,
      name: "Feature Prioritization",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [],
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: "Feature 1" } },
            { id: createId(), label: { default: "Feature 2" } },
            { id: createId(), label: { default: "Feature 3" } },
            { id: "other", label: { default: "Other" } },
          ],
          headline: { default: "Which of these features would be MOST valuable to you?" },
          required: true,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [],
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: "Feature 1" } },
            { id: createId(), label: { default: "Feature 2" } },
            { id: createId(), label: { default: "Feature 3" } },
          ],
          headline: { default: "Which of these features would be LEAST valuable to you?" },
          required: true,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "How else could we improve you experience with {{productName}}?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const gaugeFeatureSatisfaction = (): TTemplate => {
  return {
    name: "Gauge Feature Satisfaction",
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: "Evaluate the satisfaction of specific features of your product.",
    preset: {
      ...surveyDefault,
      name: "Gauge Feature Satisfaction",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: "How easy was it to achieve ... ?" },
          required: true,
          lowerLabel: { default: "Not easy" },
          upperLabel: { default: "Very easy" },
          scale: "number",
          range: 5,
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What is one thing we could do better?" },
          required: false,
          inputType: "text",
        },
      ],
      endings: [getDefaultEndingCard([])],
      hiddenFields: hiddenFieldsDefault,
    },
  };
};

const marketSiteClarity = (): TTemplate => {
  return {
    name: "Marketing Site Clarity",
    role: "marketing",
    industries: ["saas", "eCommerce", "other"],
    channels: ["website"],
    description: "Identify users dropping off your marketing site. Improve your messaging.",
    preset: {
      ...surveyDefault,
      name: "Marketing Site Clarity",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "Do you have all the info you need to give {{productName}} a try?" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Yes, totally" },
            },
            {
              id: createId(),
              label: { default: "Kind of..." },
            },
            {
              id: createId(),
              label: { default: "No, not at all" },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What’s missing or unclear to you about {{productName}}?" },
          required: false,
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: "Thanks for your answer! Get 25% off your first 6 months:" },
          required: false,
          buttonLabel: { default: "Get discount" },
          buttonUrl: "https://app.formbricks.com/auth/signup",
          buttonExternal: true,
        },
      ],
    },
  };
};

const customerEffortScore = (): TTemplate => {
  return {
    name: "Customer Effort Score (CES)",
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: "Determine how easy it is to use a feature.",
    preset: {
      ...surveyDefault,
      name: "Customer Effort Score (CES)",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: { default: "{{productName}} makes it easy for me to [ADD GOAL]" },
          required: true,
          lowerLabel: { default: "Disagree strongly" },
          upperLabel: { default: "Agree strongly" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Thanks! How could we make it easier for you to [ADD GOAL]?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const rateCheckoutExperience = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: "Rate Checkout Experience",
    role: "productManager",
    industries: ["eCommerce"],
    channels: ["website", "app"],
    description: "Let customers rate the checkout experience to tweak conversion.",
    preset: {
      ...surveyDefault,
      name: "Rate Checkout Experience",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: "How easy or difficult was it to complete the checkout?" },
          required: true,
          lowerLabel: { default: "Very difficult" },
          upperLabel: { default: "Very easy" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Sorry about that! What would have made it easier for you?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Lovely! Is there anything we can do to improve your experience?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const measureSearchExperience = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: "Measure Search Experience",
    role: "productManager",
    industries: ["saas", "eCommerce"],
    channels: ["app", "website"],
    description: "Measure how relevant your search results are.",
    preset: {
      ...surveyDefault,
      name: "Measure Search Experience",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: "How relevant are these search results?" },
          required: true,
          lowerLabel: { default: "Not at all relevant" },
          upperLabel: { default: "Very relevant" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Ugh! What makes the results irrelevant for you?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Lovely! Is there anything we can do to improve your experience?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const evaluateContentQuality = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: "Evaluate Content Quality",
    role: "marketing",
    industries: ["other"],
    channels: ["website"],
    description: "Measure if your content marketing pieces hit right.",
    preset: {
      ...surveyDefault,
      name: "Evaluate Content Quality",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: "How well did this article address what you were hoping to learn?" },
          required: true,
          lowerLabel: { default: "Not at all well" },
          upperLabel: { default: "Extremely well" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Hmpft! What were you hoping for?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Lovely! Is there anything else you would like us to cover?" },
          required: true,
          placeholder: { default: "Topics, trends, tutorials..." },
          inputType: "text",
        },
      ],
    },
  };
};

const measureTaskAccomplishment = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId()];

  return {
    name: "Measure Task Accomplishment",
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "website"],
    description: "See if people get their 'Job To Be Done' done. Successful people are better customers.",
    preset: {
      ...surveyDefault,
      name: "Measure Task Accomplishment",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
          ],
          choices: [
            { id: reusableOptionIds[0], label: { default: "Yes" } },
            { id: reusableOptionIds[1], label: { default: "Working on it, boss" } },
            { id: reusableOptionIds[2], label: { default: "No" } },
          ],
          headline: { default: "Were you able to accomplish what you came here to do today?" },
          required: true,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: "How easy was it to achieve your goal?" },
          required: true,
          lowerLabel: { default: "Very difficult" },
          upperLabel: { default: "Very easy" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "or",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "What made it hard?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "or",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Great! What did you come here to do today?" },
          required: false,
          buttonLabel: { default: "Send" },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What stopped you?" },
          required: true,
          buttonLabel: { default: "Send" },
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const identifySignUpBarriers = (): TTemplate => {
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];

  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];

  return {
    name: "Identify Sign Up Barriers",
    role: "marketing",
    industries: ["saas", "eCommerce", "other"],
    channels: ["website"],
    description: "Offer a discount to gather insights about sign up barriers.",
    preset: {
      ...surveyDefault,
      name: "{{productName}} Sign Up Barriers",
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>You seem to be considering signing up. Answer four questions and get 10% on any plan.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Answer this short survey, get 10% off!" },
          required: false,
          buttonLabel: { default: "Get 10% discount" },
          buttonExternal: false,
          dismissButtonLabel: { default: "No, thanks" },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: 5,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: "How likely are you to sign up for {{productName}}?" },
          required: true,
          lowerLabel: { default: "Not at all likely" },
          upperLabel: { default: "Very likely" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[6],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[4],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[7],
                },
              ],
            },
          ],
          choices: [
            { id: reusableOptionIds[0], label: { default: "May not have what I'm looking for" } },
            { id: reusableOptionIds[1], label: { default: "Still comparing options" } },
            { id: reusableOptionIds[2], label: { default: "Seems complicated" } },
            { id: reusableOptionIds[3], label: { default: "Pricing is a concern" } },
            { id: reusableOptionIds[4], label: { default: "Something else" } },
          ],
          headline: { default: "What is holding you back from trying {{productName}}?" },
          required: true,
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[8],
                },
              ],
            },
          ],
          headline: { default: "What do you need but {{productName}} does not offer?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[8],
                },
              ],
            },
          ],
          headline: { default: "What options are you looking at?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[5],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[8],
                },
              ],
            },
          ],
          headline: { default: "What seems complicated to you?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[6],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[8],
                },
              ],
            },
          ],
          headline: { default: "What are you concerned about regarding pricing?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[7],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Please explain:" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[8],
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>Thanks a lot for taking the time to share feedback 🙏</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: "Thanks! Here is your code: SIGNUPNOW10" },
          required: false,
          buttonUrl: "https://app.formbricks.com/auth/signup",
          buttonLabel: { default: "Sign Up" },
          buttonExternal: true,
          dismissButtonLabel: { default: "Skip for now" },
        },
      ],
    },
  };
};

const buildProductRoadmap = (): TTemplate => {
  return {
    name: "Build Product Roadmap",
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: "Identify the ONE thing your users want the most and build it.",
    preset: {
      ...surveyDefault,
      name: "{{productName}} Roadmap Input",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: "How satisfied are you with the features and functionality of {{productName}}?",
          },
          required: true,
          lowerLabel: { default: "Not at all satisfied" },
          upperLabel: { default: "Extremely satisfied" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: {
            default: "What's ONE change we could make to improve your {{productName}} experience most?",
          },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const understandPurchaseIntention = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  return {
    name: "Understand Purchase Intention",
    role: "sales",
    industries: ["eCommerce"],
    channels: ["website", "link", "app"],
    description: "Find out how close your visitors are to buy or subscribe.",
    preset: {
      ...surveyDefault,
      name: "Purchase Intention Survey",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isLessThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 2,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: 3,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: 5,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: "How likely are you to shop from us today?" },
          required: true,
          lowerLabel: { default: "Not at all likely" },
          upperLabel: { default: "Extremely likely" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "or",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Got it. What's your primary reason for visiting today?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What, if anything, is holding you back from making a purchase today?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const improveNewsletterContent = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: "Improve Newsletter Content",
    role: "marketing",
    industries: ["eCommerce", "saas", "other"],
    channels: ["link"],
    description: "Find out how your subscribers like your newsletter content.",
    preset: {
      ...surveyDefault,
      name: "Improve Newsletter Content",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: 5,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isLessThan",
                    rightOperand: {
                      type: "static",
                      value: 5,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
          ],
          range: 5,
          scale: "smiley",
          headline: { default: "How would you rate this weeks newsletter?" },
          required: true,
          lowerLabel: { default: "Meh" },
          upperLabel: { default: "Great" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "or",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "What would have made this weeks newsletter more helpful?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>Who thinks like you? You\'d do us a huge favor if you\'d share this weeks episode with your brain friend!</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: "Thanks! ❤️ Spread the love with ONE friend." },
          required: false,
          buttonUrl: "https://formbricks.com",
          buttonLabel: { default: "Happy to help!" },
          buttonExternal: true,
          dismissButtonLabel: { default: "Find your own friends" },
        },
      ],
    },
  };
};

const evaluateAProductIdea = (): TTemplate => {
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  return {
    name: "Evaluate a Product Idea",
    role: "productManager",
    industries: ["saas", "other"],
    channels: ["link", "app"],
    description: "Survey users about product or feature ideas. Get feedback rapidly.",
    preset: {
      ...surveyDefault,
      name: "Evaluate a Product Idea",
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We respect your time and kept it short 🤸</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: {
            default:
              "We love how you use {{productName}}! We'd love to pick your brain on a feature idea. Got a minute?",
          },
          required: true,
          buttonLabel: { default: "Let's do it!" },
          buttonExternal: false,
          dismissButtonLabel: { default: "Skip" },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isLessThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 3,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: "Thanks! How difficult or easy is it for you to [PROBLEM AREA] today?" },
          required: true,
          lowerLabel: { default: "Very difficult" },
          upperLabel: { default: "Very easy" },
          isColorCodingEnabled: false,
        },

        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What's most difficult for you when it comes to [PROBLEM AREA]?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[3],
          html: {
            default:
              '<p class="fb-editor-paragraph"><br></p><p class="fb-editor-paragraph" dir="ltr"><b><strong class="fb-editor-text-bold">Read the text below, then answer 2 questions:</strong></b></p><p class="fb-editor-paragraph"><br></p><p class="fb-editor-paragraph" dir="ltr"><span>Insert concept brief here. Add necessary details but keep it concise and easy to understand.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: "We're working on an idea to help with [PROBLEM AREA]." },
          required: true,
          buttonLabel: { default: "Next" },
          buttonExternal: false,
          dismissButtonLabel: { default: "Skip" },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isLessThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 3,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[6],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: "How valuable would this feature be to you?" },
          required: true,
          lowerLabel: { default: "Not valuable" },
          upperLabel: { default: "Very valuable" },
          isColorCodingEnabled: false,
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[5],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[7],
                },
              ],
            },
          ],
          headline: { default: "Got it. Why wouldn't this feature be valuable to you?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Got it. What would be most valuable to you in this feature?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[7],
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Anything else we should keep in mind?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const understandLowEngagement = (): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId(), createId()];

  const reusableOptionIds = [createId(), createId(), createId(), createId()];

  return {
    name: "Understand Low Engagement",
    role: "productManager",
    industries: ["saas"],
    channels: ["link"],
    description: "Identify reasons for low engagement to improve user adoption.",
    preset: {
      ...surveyDefault,
      name: "Reasons for Low Engagement",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: "other",
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
          ],
          choices: [
            { id: reusableOptionIds[0], label: { default: "Difficult to use" } },
            { id: reusableOptionIds[1], label: { default: "Found a better alternative" } },
            { id: reusableOptionIds[2], label: { default: "Just haven't had the time" } },
            { id: reusableOptionIds[3], label: { default: "Lacked features I need" } },
            { id: "other", label: { default: "Other" } },
          ],
          headline: { default: "What's the main reason you haven't been back to {{productName}} recently?" },
          required: true,
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "What's difficult about using {{productName}}?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Got it. Which alternative are you using instead?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Got it. How could we make it easier for you to get started?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: surveyDefault.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: "Got it. What features or functionality were missing?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [],
          headline: { default: "Please add more details:" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

const employeeWellBeing = (): TTemplate => {
  return {
    name: "Employee Well-Being",
    role: "productManager",
    industries: ["eCommerce"],
    channels: ["link"],
    description: "Assess your employee well-being through work-life balance, workload, and environment.",
    preset: {
      ...surveyDefault,
      name: "Employee Well-Being",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: "I feel that I have a good balance between my work and personal life." },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: "Very poor balance",
          },
          upperLabel: {
            default: "Excellent balance",
          },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: "My workload is manageable, allowing me to stay productive without feeling overwhelmed.",
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: "Overwhelming workload",
          },
          upperLabel: {
            default: "Perfectly manageable",
          },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: "The work environment supports my physical and mental well-being." },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: "Not supportive",
          },
          upperLabel: {
            default: "Highly supportive",
          },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What changes, if any, would improve your overall well-being at work?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  };
};

export const templates: TTemplate[] = [
  cartAbandonmentSurvey(),
  siteAbandonmentSurvey(),
  productMarketFitSuperhuman(),
  onboardingSegmentation(),
  churnSurvey(),
  earnedAdvocacyScore(),
  improveTrialConversion(),
  reviewPrompt(),
  interviewPrompt(),
  improveActivationRate(),
  uncoverStrengthsAndWeaknesses(),
  productMarketFitShort(),
  marketAttribution(),
  changingSubscriptionExperience(),
  identifyCustomerGoals(),
  featureChaser(),
  fakeDoorFollowUp(),
  feedbackBox(),
  integrationSetupSurvey(),
  newIntegrationSurvey(),
  docsFeedback(),
  NPS(),
  customerSatisfactionScore(),
  collectFeedback(),
  identifyUpsellOpportunities(),
  prioritizeFeatures(),
  gaugeFeatureSatisfaction(),
  marketSiteClarity(),
  customerEffortScore(),
  rateCheckoutExperience(),
  measureSearchExperience(),
  evaluateContentQuality(),
  measureTaskAccomplishment(),
  identifySignUpBarriers(),
  buildProductRoadmap(),
  understandPurchaseIntention(),
  improveNewsletterContent(),
  evaluateAProductIdea(),
  understandLowEngagement(),
  employeeSatisfaction(),
  employeeWellBeing(),
];

export const customSurvey = {
  name: "Start from scratch",
  description: "Create a survey without template.",
  preset: {
    ...surveyDefault,
    name: "New Survey",
    questions: [
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "What would you like to know?" },
        placeholder: { default: "Type your answer here..." },
        required: true,
        inputType: "text",
      } as TSurveyOpenTextQuestion,
    ],
  },
};

export const getExampleWebsiteSurveyTemplate = (
  webAppUrl: string,
  trigger: TActionClass
): TSurveyCreateInput => ({
  ...customSurvey.preset,
  questions: customSurvey.preset.questions.map(
    (question) =>
      ({
        ...question,
        type: TSurveyQuestionTypeEnum.CTA,
        headline: { default: "Website successfully connected 🎉" },
        html: {
          default: "You're all set up. Create your own survey for website visitors 👇",
        },
        buttonLabel: { default: "Let's do it!" },
        buttonExternal: true,
        imageUrl: `${webAppUrl}/onboarding/meme.png`,
      }) as TSurveyCTAQuestion
  ),
  name: "Example website survey",
  type: "website" as TSurveyType,
  autoComplete: 2,
  triggers: [{ actionClass: trigger }],
  status: "inProgress" as TSurveyStatus,
  displayOption: "respondMultiple" as TSurveyDisplayOption,
  recontactDays: 0,
  isVerifyEmailEnabled: false,
});

export const getExampleAppSurveyTemplate = (
  webAppUrl: string,
  trigger: TActionClass
): TSurveyCreateInput => ({
  ...customSurvey.preset,
  questions: customSurvey.preset.questions.map(
    (question) =>
      ({
        ...question,
        type: TSurveyQuestionTypeEnum.CTA,
        headline: { default: "App successfully connected" },
        html: {
          default: "You're all set up. Create your own survey for your app users.",
        },
        buttonLabel: { default: "Let's do it!" },
        buttonExternal: true,
        imageUrl: `${webAppUrl}/onboarding/meme.png`,
      }) as TSurveyCTAQuestion
  ),
  name: "Example app survey",
  type: "app" as TSurveyType,
  autoComplete: 2,
  triggers: [{ actionClass: trigger }],
  status: "inProgress" as TSurveyStatus,
  displayOption: "respondMultiple" as TSurveyDisplayOption,
  recontactDays: 0,
  isVerifyEmailEnabled: false,
});
