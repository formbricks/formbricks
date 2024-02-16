import { createId } from "@paralleldrive/cuid2";

import { TSurveyHiddenFields, TSurveyQuestionType, TSurveyWelcomeCard } from "@formbricks/types/surveys";
import { TTemplate } from "@formbricks/types/templates";

const thankYouCardDefault = {
  enabled: true,
  headline: "Thank you!",
  subheader: "We appreciate your feedback.",
  buttonLabel: "Create your own Survey",
  buttonLink: "https://formbricks.com/signup",
};

const hiddenFieldsDefault: TSurveyHiddenFields = {
  enabled: true,
  fieldIds: [],
};

const welcomeCardDefault: TSurveyWelcomeCard = {
  enabled: false,
  headline: "Welcome!",
  html: "Thanks for providing your feedback - let's go!",
  timeToFinish: true,
  showResponseCount: false,
};

export const templates: TTemplate[] = [
  {
    name: "Churn Survey",

    category: "Increase Revenue",
    objectives: ["sharpen_marketing_messaging", "improve_user_retention"],
    description: "Find out why people cancel their subscriptions. These insights are pure gold!",
    preset: {
      name: "Churn Survey",
      welcomeCard: welcomeCardDefault,
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionType.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            { value: "Difficult to use", condition: "equals", destination: "sxwpskjgzzpmkgfxzi15inif" },
            { value: "It's too expensive", condition: "equals", destination: "mao94214zoo6c1at5rpuz7io" },
            {
              value: "I am missing features",
              condition: "equals",
              destination: "l054desub14syoie7n202vq4",
            },
            {
              value: "Poor customer service",
              condition: "equals",
              destination: "hdftsos1odzjllr7flj4m3j9",
            },
            { value: "I just didn't need it anymore", condition: "equals", destination: "end" },
          ],
          choices: [
            { id: createId(), label: "Difficult to use" },
            { id: createId(), label: "It's too expensive" },
            { id: createId(), label: "I am missing features" },
            { id: createId(), label: "Poor customer service" },
            { id: createId(), label: "I just didn't need it anymore" },
          ],
          headline: "Why did you cancel your subscription?",
          required: true,
          subheader: "We're sorry to see you leave. Help us do better:",
        },
        {
          id: "sxwpskjgzzpmkgfxzi15inif",
          type: TSurveyQuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "What would have made {{productName}} easier to use?",
          required: true,
          subheader: "",
          buttonLabel: "Send",
          inputType: "text",
        },
        {
          id: "mao94214zoo6c1at5rpuz7io",
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>We\'d love to keep you as a customer. Happy to offer a 30% discount for the next year.</span></p>',
          type: TSurveyQuestionType.CTA,
          logic: [{ condition: "clicked", destination: "end" }],
          headline: "Get 30% off for the next year!",
          required: true,
          buttonUrl: "https://formbricks.com",
          buttonLabel: "Get 30% off",
          buttonExternal: true,
          dismissButtonLabel: "Skip",
        },
        {
          id: "l054desub14syoie7n202vq4",
          type: TSurveyQuestionType.OpenText,

          logic: [{ condition: "submitted", destination: "end" }],
          headline: "What features are you missing?",
          required: true,
          subheader: "",
          inputType: "text",
        },
        {
          id: "hdftsos1odzjllr7flj4m3j9",
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>We aim to provide the best possible customer service. Please email our CEO and she will personally handle your issue.</span></p>',
          type: TSurveyQuestionType.CTA,
          logic: [{ condition: "clicked", destination: "end" }],
          headline: "So sorry to hear 😔 Talk to our CEO directly!",
          required: true,
          buttonUrl: "mailto:ceo@company.com",
          buttonLabel: "Send email to CEO",
          buttonExternal: true,
          dismissButtonLabel: "Skip",
        },
      ],
      thankYouCard: thankYouCardDefault,
      hiddenFields: hiddenFieldsDefault,
    },
  },
  {
    name: "Feedback Box",

    category: "Product Experience",
    objectives: ["improve_user_retention"],
    description: "Give your users the chance to seamlessly share what's on their minds.",
    preset: {
      name: "Feedback Box",
      welcomeCard: welcomeCardDefault,
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionType.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            { value: "Bug report 🐞", condition: "equals", destination: "dnbiuq4l33l7jypcf2cg6vhh" },
            { value: "Feature Request 💡", condition: "equals", destination: "en9nuuevbf7g9oa9rzcs1l50" },
          ],
          choices: [
            { id: createId(), label: "Bug report 🐞" },
            { id: createId(), label: "Feature Request 💡" },
          ],
          headline: "What's on your mind, boss?",
          required: true,
          subheader: "Thanks for sharing. We'll get back to you asap.",
        },
        {
          id: "dnbiuq4l33l7jypcf2cg6vhh",
          type: TSurveyQuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "a6c76m5oocw6xp9agf3d2tam" }],
          headline: "What's broken?",
          required: true,
          subheader: "The more detail, the better :)",
          inputType: "text",
        },
        {
          id: "a6c76m5oocw6xp9agf3d2tam",
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>We will fix this as soon as possible. Do you want to be notified when we did?</span></p>',
          type: TSurveyQuestionType.CTA,
          logic: [
            { condition: "clicked", destination: "end" },
            { condition: "skipped", destination: "end" },
          ],
          headline: "Want to stay in the loop?",
          required: false,
          buttonLabel: "Yes, notify me",
          buttonExternal: false,
          dismissButtonLabel: "No, thanks",
        },
        {
          id: "en9nuuevbf7g9oa9rzcs1l50",
          type: TSurveyQuestionType.OpenText,
          headline: "Lovely, tell us more!",
          required: true,
          subheader: "What problem do you want us to solve?",
          buttonLabel: "Request feature",
          placeholder: "Type your answer here...",
          inputType: "text",
        },
      ],
      thankYouCard: thankYouCardDefault,
      hiddenFields: hiddenFieldsDefault,
    },
  },
  {
    name: "Identify Customer Goals",

    category: "Product Experience",
    objectives: ["increase_user_adoption", "sharpen_marketing_messaging", "improve_user_retention"],
    description:
      "Better understand if your messaging creates the right expectations of the value your product provides.",
    preset: {
      name: "Identify Customer Goals",
      welcomeCard: welcomeCardDefault,
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionType.MultipleChoiceSingle,
          headline: "What's your primary goal for using {{productName}}?",
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: "Understand my user base deeply",
            },
            {
              id: createId(),
              label: "Identify upselling opportunities",
            },
            {
              id: createId(),
              label: "Build the best possible product",
            },
            {
              id: createId(),
              label: "Rule the world to make everyone breakfast brussels sprouts.",
            },
          ],
        },
      ],
      thankYouCard: thankYouCardDefault,
      hiddenFields: hiddenFieldsDefault,
    },
  },
];
