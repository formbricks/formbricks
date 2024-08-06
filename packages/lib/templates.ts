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
    buttonLink: "https://formbricks.com/signup",
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

const surveyDefault: TTemplate["preset"] = {
  name: "New Survey",
  welcomeCard: welcomeCardDefault,
  endings: [getDefaultEndingCard([])],
  hiddenFields: hiddenFieldsDefault,
  questions: [],
};

export const templates: TTemplate[] = [
  {
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
          id: createId(),
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We noticed you left some items in your cart. We would love to understand why.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [{ condition: "skipped", destination: surveyDefault.endings[0].id }],
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
          id: createId(),
          logic: [{ condition: "skipped", destination: "bxvvhol84ir34q2vsvr5kwl9" }],
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
          id: "bxvvhol84ir34q2vsvr5kwl9",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Any additional comments or suggestions?" },
          required: false,
          inputType: "text",
        },
      ],
    },
  },
  {
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
          id: createId(),
          html: {
            default:
              "<p class='fb-editor-paragraph' dir='ltr'><span>We noticed you're  leaving our site without making a purchase. We would love to understand why.</span></p>",
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [{ condition: "skipped", destination: surveyDefault.endings[0].id }],
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
          id: createId(),
          logic: [{ condition: "skipped", destination: "bxvvhol84ir34q2vsvr5kwl9" }],
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
          id: "bxvvhol84ir34q2vsvr5kwl9",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Any additional comments or suggestions?" },
          required: false,
          inputType: "text",
        },
      ],
    },
  },
  {
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
          id: createId(),
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We would love to understand your user experience better. Sharing your insight helps a lot.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [{ condition: "skipped", destination: surveyDefault.endings[0].id }],
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
  },
  {
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
  },
  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            { value: "Difficult to use", condition: "equals", destination: "sxwpskjgzzpmkgfxzi15inif" },
            { value: "It's too expensive", condition: "equals", destination: "mao94214zoo6c1at5rpuz7io" },
            { value: "I am missing features", condition: "equals", destination: "l054desub14syoie7n202vq4" },
            { value: "Poor customer service", condition: "equals", destination: "hdftsos1odzjllr7flj4m3j9" },
            {
              value: "I just didn't need it anymore",
              condition: "equals",
              destination: surveyDefault.endings[0].id,
            },
          ],
          choices: [
            { id: createId(), label: { default: "Difficult to use" } },
            { id: createId(), label: { default: "It's too expensive" } },
            { id: createId(), label: { default: "I am missing features" } },
            { id: createId(), label: { default: "Poor customer service" } },
            { id: createId(), label: { default: "I just didn't need it anymore" } },
          ],
          headline: { default: "Why did you cancel your subscription?" },
          required: true,
          subheader: { default: "We're sorry to see you leave. Help us do better:" },
        },
        {
          id: "sxwpskjgzzpmkgfxzi15inif",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "What would have made {{productName}} easier to use?" },
          required: true,
          buttonLabel: { default: "Send" },
          inputType: "text",
        },
        {
          id: "mao94214zoo6c1at5rpuz7io",
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We\'d love to keep you as a customer. Happy to offer a 30% discount for the next year.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [{ condition: "clicked", destination: surveyDefault.endings[0].id }],
          headline: { default: "Get 30% off for the next year!" },
          required: true,
          buttonUrl: "https://formbricks.com",
          buttonLabel: { default: "Get 30% off" },
          buttonExternal: true,
          dismissButtonLabel: { default: "Skip" },
        },
        {
          id: "l054desub14syoie7n202vq4",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "What features are you missing?" },
          required: true,
          inputType: "text",
        },
        {
          id: "hdftsos1odzjllr7flj4m3j9",
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We aim to provide the best possible customer service. Please email our CEO and she will personally handle your issue.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [{ condition: "clicked", destination: surveyDefault.endings[0].id }],
          headline: { default: "So sorry to hear 😔 Talk to our CEO directly!" },
          required: true,
          buttonUrl: "mailto:ceo@company.com",
          buttonLabel: { default: "Send email to CEO" },
          buttonExternal: true,
          dismissButtonLabel: { default: "Skip" },
        },
      ],
    },
  },
  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [{ value: "No", condition: "equals", destination: "duz2qp8eftix9wty1l221x1h" }],
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: "Yes" } },
            { id: createId(), label: { default: "No" } },
          ],
          headline: { default: "Have you actively recommended {{productName}} to others?" },
          required: true,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: "yhfew1j3ng6luy7t7qynwj79" }],
          headline: { default: "Great to hear! Why did you recommend us?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "duz2qp8eftix9wty1l221x1h",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "So sad. Why not?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "yhfew1j3ng6luy7t7qynwj79",
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [{ value: "No", condition: "equals", destination: surveyDefault.endings[0].id }],
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: "Yes" } },
            { id: createId(), label: { default: "No" } },
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
  },
  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              value: "I didn't get much value out of it",
              condition: "equals",
              destination: "aew2ymg51mffnt9db7duz9t3",
            },
            {
              value: "I expected something else",
              condition: "equals",
              destination: "rnrfydttavtsf2t2nfx1df7m",
            },
            {
              value: "It's too expensive for what it does",
              condition: "equals",
              destination: "x760wga1fhtr1i80cpssr7af",
            },
            {
              value: "I am missing a feature",
              condition: "equals",
              destination: "rbhww1pix03r6sl4xc511wqg",
            },
            {
              value: "I was just looking around",
              condition: "equals",
              destination: surveyDefault.endings[0].id,
            },
          ],
          choices: [
            { id: createId(), label: { default: "I didn't get much value out of it" } },
            { id: createId(), label: { default: "I expected something else" } },
            { id: createId(), label: { default: "It's too expensive for what it does" } },
            { id: createId(), label: { default: "I am missing a feature" } },
            { id: createId(), label: { default: "I was just looking around" } },
          ],
          headline: { default: "Why did you stop your trial?" },
          required: true,
          subheader: { default: "Help us understand you better:" },
        },
        {
          id: "aew2ymg51mffnt9db7duz9t3",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: "bqiyml1ym74ggx6htwdo7rlu" }],
          headline: { default: "Sorry to hear. What was the biggest problem using {{productName}}?" },
          required: true,
          buttonLabel: { default: "Next" },
          inputType: "text",
        },
        {
          id: "rnrfydttavtsf2t2nfx1df7m",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: "bqiyml1ym74ggx6htwdo7rlu" }],
          headline: { default: "What did you expect {{productName}} would do for you?" },
          required: true,
          buttonLabel: { default: "Next" },
          inputType: "text",
        },
        {
          id: "x760wga1fhtr1i80cpssr7af",
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We\'re happy to offer you a 20% discount on a yearly plan.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [{ condition: "clicked", destination: surveyDefault.endings[0].id }],
          headline: { default: "Sorry to hear! Get 20% off the first year." },
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: { default: "Get 20% off" },
          buttonExternal: true,
          dismissButtonLabel: { default: "Skip" },
        },
        {
          id: "rbhww1pix03r6sl4xc511wqg",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: "bqiyml1ym74ggx6htwdo7rlu" }],
          headline: { default: "Which features are you missing?" },
          required: true,
          subheader: { default: "What would you like to achieve?" },
          buttonLabel: { default: "Next" },
          inputType: "text",
        },
        {
          id: "bqiyml1ym74ggx6htwdo7rlu",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            { condition: "submitted", destination: surveyDefault.endings[0].id },
            { condition: "skipped", destination: surveyDefault.endings[0].id },
          ],
          headline: { default: "How are you solving your problem now?" },
          required: false,
          subheader: { default: "Please name alternative solutions:" },
          inputType: "text",
        },
      ],
    },
  },
  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [{ value: 3, condition: "lessEqual", destination: "tk9wpw2gxgb8fa6pbpp3qq5l" }],
          range: 5,
          scale: "star",
          headline: { default: "How do you like {{productName}}?" },
          required: true,
          lowerLabel: { default: "Not good" },
          upperLabel: { default: "Very satisfied" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          html: { default: '<p class="fb-editor-paragraph" dir="ltr"><span>This helps us a lot.</span></p>' },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [{ condition: "clicked", destination: surveyDefault.endings[0].id }],
          headline: { default: "Happy to hear 🙏 Please write a review for us!" },
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: { default: "Write review" },
          buttonExternal: true,
        },
        {
          id: "tk9wpw2gxgb8fa6pbpp3qq5l",
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
  },
  {
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
  },
  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              value: "Difficult to set up or use",
              condition: "equals",
              destination: "r0zvi3vburf4hm7qewimzjux",
            },
            {
              value: "Lacked features/functionality",
              condition: "equals",
              destination: "rbwz3y6y9avzqcfj30nu0qj4",
            },
            {
              value: "Just haven't had the time",
              condition: "equals",
              destination: "gn6298zogd2ipdz7js17qy5i",
            },
            {
              value: "Something else",
              condition: "equals",
              destination: "c0exdyri3erugrv0ezkyseh6",
            },
          ],
          choices: [
            { id: createId(), label: { default: "Didn't seem useful to me" } },
            { id: createId(), label: { default: "Difficult to set up or use" } },
            { id: createId(), label: { default: "Lacked features/functionality" } },
            { id: createId(), label: { default: "Just haven't had the time" } },
            { id: createId(), label: { default: "Something else" } },
          ],
          headline: {
            default: "What's the main reason why you haven't finished setting up {{productName}}?",
          },
          required: true,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "What made you think {{productName}} wouldn't be useful?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "r0zvi3vburf4hm7qewimzjux",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "What was difficult about setting up or using {{productName}}?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "rbwz3y6y9avzqcfj30nu0qj4",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "What features or functionality were missing?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "gn6298zogd2ipdz7js17qy5i",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "How could we make it easier for you to get started?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "c0exdyri3erugrv0ezkyseh6",
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },

  {
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
  },

  {
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
  },

  {
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
  },

  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            { value: "Bug report 🐞", condition: "equals", destination: "dnbiuq4l33l7jypcf2cg6vhh" },
            { value: "Feature Request 💡", condition: "equals", destination: "en9nuuevbf7g9oa9rzcs1l50" },
          ],
          choices: [
            { id: createId(), label: { default: "Bug report 🐞" } },
            { id: createId(), label: { default: "Feature Request 💡" } },
          ],
          headline: { default: "What's on your mind, boss?" },
          required: true,
          subheader: { default: "Thanks for sharing. We'll get back to you asap." },
        },
        {
          id: "dnbiuq4l33l7jypcf2cg6vhh",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: "a6c76m5oocw6xp9agf3d2tam" }],
          headline: { default: "What's broken?" },
          required: true,
          subheader: { default: "The more detail, the better :)" },
          inputType: "text",
        },
        {
          id: "a6c76m5oocw6xp9agf3d2tam",
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>We will fix this as soon as possible. Do you want to be notified when we did?</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            { condition: "clicked", destination: surveyDefault.endings[0].id },
            { condition: "skipped", destination: surveyDefault.endings[0].id },
          ],
          headline: { default: "Want to stay in the loop?" },
          required: false,
          buttonLabel: { default: "Yes, notify me" },
          buttonExternal: false,
          dismissButtonLabel: { default: "No, thanks" },
        },
        {
          id: "en9nuuevbf7g9oa9rzcs1l50",
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
  },

  {
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
          id: "s6ss6znzxdwjod1hv16fow4w",
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [{ value: 4, condition: "greaterEqual", destination: "ef0qo3l8iisd517ikp078u1p" }],
          range: 5,
          scale: "number",
          headline: { default: "How easy was it to set this integration up?" },
          required: true,
          lowerLabel: { default: "Not easy" },
          upperLabel: { default: "Very easy" },
          isColorCodingEnabled: false,
        },
        {
          id: "mko13ptjj6tpi5u2pl7a5drz",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Why was it hard?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "ef0qo3l8iisd517ikp078u1p",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What other tools would you like to use with {{productName}}?" },
          required: false,
          subheader: { default: "We keep building integrations, yours can be next:" },
          inputType: "text",
        },
      ],
    },
  },

  {
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
  },

  {
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
  },

  {
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
  },

  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [{ value: 3, condition: "lessEqual", destination: "vyo4mkw4ln95ts4ya7qp2tth" }],
          range: 5,
          scale: "smiley",
          headline: { default: "How satisfied are you with your {{productName}} experience?" },
          required: true,
          lowerLabel: { default: "Not satisfied" },
          upperLabel: { default: "Very satisfied" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "Lovely! Is there anything we can do to improve your experience?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "vyo4mkw4ln95ts4ya7qp2tth",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Ugh, sorry! Is there anything we can do to improve your experience?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  },

  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [{ value: "3", condition: "lessEqual", destination: "dlpa0371pe7rphmggy2sgbap" }],
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: "gwo0fq5kug13e83fcour4n1w" }],
          headline: { default: "Lovely! What did you like about it?" },
          required: true,
          longAnswer: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "dlpa0371pe7rphmggy2sgbap",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Thanks for sharing! What did you not like?" },
          required: true,
          longAnswer: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "gwo0fq5kug13e83fcour4n1w",
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Anything else you'd like to share with our team?" },
          required: false,
          longAnswer: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "sjbaghd1bi59pkjun2c97kw9",
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [],
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Lastly, we'd love to respond to your feedback. Please share your email:" },
          required: false,
          inputType: "email",
          longAnswer: false,
          placeholder: { default: "example@email.com" },
        },
      ],
    },
  },

  {
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
  },

  {
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
  },

  {
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
  },

  {
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
  },

  {
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
  },

  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [{ value: 4, condition: "greaterEqual", destination: "lpof3d9t9hmnqvyjlpksmxd7" }],
          range: 5,
          scale: "number",
          headline: { default: "How easy or difficult was it to complete the checkout?" },
          required: true,
          lowerLabel: { default: "Very difficult" },
          upperLabel: { default: "Very easy" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "Sorry about that! What would have made it easier for you?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "lpof3d9t9hmnqvyjlpksmxd7",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Lovely! Is there anything we can do to improve your experience?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  },

  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [{ value: 4, condition: "greaterEqual", destination: "adcs3d9t9hmnqvyjlpksmxd7" }],
          range: 5,
          scale: "number",
          headline: { default: "How relevant are these search results?" },
          required: true,
          lowerLabel: { default: "Not at all relevant" },
          upperLabel: { default: "Very relevant" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "Ugh! What makes the results irrelevant for you?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "adcs3d9t9hmnqvyjlpksmxd7",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Lovely! Is there anything we can do to improve your experience?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  },

  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [{ value: 4, condition: "greaterEqual", destination: "adcs3d9t9hmnqvyjlpkswi38" }],
          range: 5,
          scale: "number",
          headline: { default: "How well did this article address what you were hoping to learn?" },
          required: true,
          lowerLabel: { default: "Not at all well" },
          upperLabel: { default: "Extremely well" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "Hmpft! What were you hoping for?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "adcs3d9t9hmnqvyjlpkswi38",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Lovely! Is there anything else you would like us to cover?" },
          required: true,
          placeholder: { default: "Topics, trends, tutorials..." },
          inputType: "text",
        },
      ],
    },
  },

  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            { value: "Working on it, boss", condition: "equals", destination: "nq88udm0jjtylr16ax87xlyc" },
            { value: "Yes", condition: "equals", destination: "rjeac33gd13h3nnbrbid1fb2" },
            { value: "No", condition: "equals", destination: "u83zhr66knyfozccoqojx7bc" },
          ],
          choices: [
            { id: createId(), label: { default: "Yes" } },
            { id: createId(), label: { default: "Working on it, boss" } },
            { id: createId(), label: { default: "No" } },
          ],
          headline: { default: "Were you able to accomplish what you came here to do today?" },
          required: true,
        },
        {
          id: "rjeac33gd13h3nnbrbid1fb2",
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [{ value: 4, condition: "greaterEqual", destination: "nq88udm0jjtylr16ax87xlyc" }],
          range: 5,
          scale: "number",
          headline: { default: "How easy was it to achieve your goal?" },
          required: true,
          lowerLabel: { default: "Very difficult" },
          upperLabel: { default: "Very easy" },
          isColorCodingEnabled: false,
        },
        {
          id: "s0999bhpaz8vgf7ps264piek",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            { condition: "submitted", destination: surveyDefault.endings[0].id },
            { condition: "skipped", destination: surveyDefault.endings[0].id },
          ],
          headline: { default: "What made it hard?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "nq88udm0jjtylr16ax87xlyc",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            { condition: "skipped", destination: surveyDefault.endings[0].id },
            { condition: "submitted", destination: surveyDefault.endings[0].id },
          ],
          headline: { default: "Great! What did you come here to do today?" },
          required: false,
          buttonLabel: { default: "Send" },
          inputType: "text",
        },
        {
          id: "u83zhr66knyfozccoqojx7bc",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What stopped you?" },
          required: true,
          buttonLabel: { default: "Send" },
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  },

  {
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
          id: createId(),
          html: {
            default:
              '<p class="fb-editor-paragraph" dir="ltr"><span>You seem to be considering signing up. Answer four questions and get 10% on any plan.</span></p>',
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [{ condition: "skipped", destination: surveyDefault.endings[0].id }],
          headline: { default: "Answer this short survey, get 10% off!" },
          required: false,
          buttonLabel: { default: "Get 10% discount" },
          buttonExternal: false,
          dismissButtonLabel: { default: "No, thanks" },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [{ value: "5", condition: "equals", destination: surveyDefault.endings[0].id }],
          range: 5,
          scale: "number",
          headline: { default: "How likely are you to sign up for {{productName}}?" },
          required: true,
          lowerLabel: { default: "Not at all likely" },
          upperLabel: { default: "Very likely" },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              value: "May not have what I'm looking for",
              condition: "equals",
              destination: "atiw0j1oykb77zr0b7q4tixu",
            },
            {
              value: "Still comparing options",
              condition: "equals",
              destination: "j7jkpolm5xl7u0zt3g0e4z7d",
            },
            { value: "Seems complicated", condition: "equals", destination: "t5gvag2d7kq311szz5iyiy79" },
            { value: "Pricing is a concern", condition: "equals", destination: "or0yhhrof753sq9ug4mdavgz" },
            { value: "Something else", condition: "equals", destination: "v0pq1qcnm6ohiry5ywcd91qq" },
          ],
          choices: [
            { id: createId(), label: { default: "May not have what I'm looking for" } },
            { id: createId(), label: { default: "Still comparing options" } },
            { id: createId(), label: { default: "Seems complicated" } },
            { id: createId(), label: { default: "Pricing is a concern" } },
            { id: createId(), label: { default: "Something else" } },
          ],
          headline: { default: "What is holding you back from trying {{productName}}?" },
          required: true,
        },
        {
          id: "atiw0j1oykb77zr0b7q4tixu",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: "k3q0vt1ko0bzbsq076p7lnys" }],
          headline: { default: "What do you need but {{productName}} does not offer?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "j7jkpolm5xl7u0zt3g0e4z7d",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: "k3q0vt1ko0bzbsq076p7lnys" }],
          headline: { default: "What options are you looking at?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "t5gvag2d7kq311szz5iyiy79",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: "k3q0vt1ko0bzbsq076p7lnys" }],
          headline: { default: "What seems complicated to you?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "or0yhhrof753sq9ug4mdavgz",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: "k3q0vt1ko0bzbsq076p7lnys" }],
          headline: { default: "What are you concerned about regarding pricing?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "v0pq1qcnm6ohiry5ywcd91qq",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Please explain:" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "k3q0vt1ko0bzbsq076p7lnys",
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
  },

  {
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
  },

  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            { value: "2", condition: "lessEqual", destination: "y19mwcmstlc7pi7s4izxk1ll" },
            { value: "3", condition: "equals", destination: "zm1hs8qkeuidh3qm0hx8pnw7" },
            { value: "4", condition: "equals", destination: "zm1hs8qkeuidh3qm0hx8pnw7" },
            { value: "5", condition: "equals", destination: surveyDefault.endings[0].id },
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
          id: "y19mwcmstlc7pi7s4izxk1ll",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            { condition: "submitted", destination: surveyDefault.endings[0].id },
            { condition: "skipped", destination: surveyDefault.endings[0].id },
          ],
          headline: { default: "Got it. What's your primary reason for visiting today?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "zm1hs8qkeuidh3qm0hx8pnw7",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What, if anything, is holding you back from making a purchase today?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  },

  {
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            { value: "5", condition: "equals", destination: "l2q1chqssong8n0xwaagyl8g" },
            { value: "5", condition: "lessThan", destination: "k3s6gm5ivkc5crpycdbpzkpa" },
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
          id: "k3s6gm5ivkc5crpycdbpzkpa",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [
            { condition: "submitted", destination: surveyDefault.endings[0].id },
            { condition: "skipped", destination: surveyDefault.endings[0].id },
          ],
          headline: { default: "What would have made this weeks newsletter more helpful?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "l2q1chqssong8n0xwaagyl8g",
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
  },

  {
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
          id: createId(),
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            { value: "3", condition: "lessEqual", destination: "ndacjg9lqf5jcpq9w8ote666" },
            { value: "4", condition: "greaterEqual", destination: "jmzgbo73cfjswlvhoynn7o0q" },
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
          id: "ndacjg9lqf5jcpq9w8ote666",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "What's most difficult for you when it comes to [PROBLEM AREA]?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "jmzgbo73cfjswlvhoynn7o0q",
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
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            { value: "3", condition: "lessEqual", destination: "mmiuun3z4e7gk4ufuwh8lq8q" },
            { value: "4", condition: "greaterEqual", destination: "gvzevzw4hkqd6dmlkcly6kd1" },
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
          id: "mmiuun3z4e7gk4ufuwh8lq8q",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: "bqmnpyku9etsgbtb322luzb2" }],
          headline: { default: "Got it. Why wouldn't this feature be valuable to you?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "gvzevzw4hkqd6dmlkcly6kd1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Got it. What would be most valuable to you in this feature?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "bqmnpyku9etsgbtb322luzb2",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Anything else we should keep in mind?" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  },

  {
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
          id: "aq9dafe9nxe0kpm67b1os2z9",
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            { value: "Difficult to use", condition: "equals", destination: "r0zvi3vburf4hm7qewimzjux" },
            {
              value: "Found a better alternative",
              condition: "equals",
              destination: "g92s5wetp51ps6afmc6y7609",
            },
            {
              value: "Just haven't had the time",
              condition: "equals",
              destination: "gn6298zogd2ipdz7js17qy5i",
            },
            {
              value: "Lacked features I need",
              condition: "equals",
              destination: "rbwz3y6y9avzqcfj30nu0qj4",
            },
            { value: "Other", condition: "equals", destination: "c0exdyri3erugrv0ezkyseh6" },
          ],
          choices: [
            { id: "xoqb0wjjsk4t0lx0i7jrhx26", label: { default: "Difficult to use" } },
            { id: "p768nlw47ndehtgzx6m82dr6", label: { default: "Found a better alternative" } },
            { id: "izt28ma5ep3s92531owxj1vg", label: { default: "Just haven't had the time" } },
            { id: "dhkp2wb9e1tv7kfu8csjhzbh", label: { default: "Lacked features I need" } },
            { id: "other", label: { default: "Other" } },
          ],
          headline: { default: "What's the main reason you haven't been back to {{productName}} recently?" },
          required: true,
        },
        {
          id: "r0zvi3vburf4hm7qewimzjux",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "What's difficult about using {{productName}}?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "g92s5wetp51ps6afmc6y7609",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "Got it. Which alternative are you using instead?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "gn6298zogd2ipdz7js17qy5i",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "Got it. How could we make it easier for you to get started?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "rbwz3y6y9avzqcfj30nu0qj4",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [{ condition: "submitted", destination: surveyDefault.endings[0].id }],
          headline: { default: "Got it. What features or functionality were missing?" },
          required: true,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
        {
          id: "c0exdyri3erugrv0ezkyseh6",
          type: TSurveyQuestionTypeEnum.OpenText,
          logic: [],
          headline: { default: "Please add more details:" },
          required: false,
          placeholder: { default: "Type your answer here..." },
          inputType: "text",
        },
      ],
    },
  },
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
        subheader: { default: "This is an example survey." },
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
        headline: { default: "App successfully connected 🥳" },
        html: {
          default: "You're all set up. Create your own survey for your app users 👇",
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
