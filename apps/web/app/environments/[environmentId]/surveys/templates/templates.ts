import { QuestionType } from "@formbricks/types/questions";
import type { Template } from "@formbricks/types/templates";
import { createId } from "@paralleldrive/cuid2";

const thankYouCardDefault = {
  enabled: true,
  headline: "Thank you!",
  subheader: "We appreciate your feedback.",
};

export const templates: Template[] = [
  {
    name: "Product Market Fit (Superhuman)",
    category: "Product Experience",

    description: "Measure PMF by assessing how disappointed users would be if your product disappeared.",
    preset: {
      name: "Product Market Fit (Superhuman)",
      questions: [
        {
          id: createId(),
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>We would love to understand your user experience better. Sharing your insight helps a lot!</span></p>',
          type: QuestionType.CTA,
          logic: [{ condition: "skipped", destination: "end" }],
          headline: "You are one of our power users! Do you have 5 minutes?",
          required: false,
          buttonLabel: "Happy to help!",
          buttonExternal: false,
          dismissButtonLabel: "No, thanks.",
        },
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "How disappointed would you be if you could no longer use {{productName}}?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Not at all disappointed",
            },
            {
              id: createId(),
              label: "Somewhat disappointed",
            },
            {
              id: createId(),
              label: "Very disappointed",
            },
          ],
        },
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "What is your role?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Founder",
            },
            {
              id: createId(),
              label: "Executive",
            },
            {
              id: createId(),
              label: "Product Manager",
            },
            {
              id: createId(),
              label: "Product Owner",
            },
            {
              id: createId(),
              label: "Software Engineer",
            },
          ],
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "What type of people do you think would most benefit from {{productName}}?",
          required: true,
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "What is the main benefit your receive from {{productName}}?",
          required: true,
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "How can we improve {{productName}} for you?",
          subheader: "Please be as specific as possible.",
          required: true,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Onboarding Segmentation",
    category: "Product Experience",
    objectives: ["increase_user_adoption", "improve_user_retention"],
    description: "Learn more about who signed up to your product and why.",
    preset: {
      name: "Onboarding Segmentation",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "What is your role?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Founder",
            },
            {
              id: createId(),
              label: "Executive",
            },
            {
              id: createId(),
              label: "Product Manager",
            },
            {
              id: createId(),
              label: "Product Owner",
            },
            {
              id: createId(),
              label: "Software Engineer",
            },
          ],
        },
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "What's your company size?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "only me",
            },
            {
              id: createId(),
              label: "1-5 employees",
            },
            {
              id: createId(),
              label: "6-10 employees",
            },
            {
              id: createId(),
              label: "11-100 employees",
            },
            {
              id: createId(),
              label: "over 100 employees",
            },
          ],
        },
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "How did you hear about us first?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Recommendation",
            },
            {
              id: createId(),
              label: "Social Media",
            },
            {
              id: createId(),
              label: "Ads",
            },
            {
              id: createId(),
              label: "Google Search",
            },
            {
              id: createId(),
              label: "In a Podcast",
            },
          ],
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Churn Survey",

    category: "Increase Revenue",
    objectives: ["sharpen_marketing_messaging", "improve_user_retention"],
    description: "Find out why people cancel their subscriptions. These insights are pure gold!",
    preset: {
      name: "Churn Survey",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,

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
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "What would have made {{productName}} easier to use?",
          required: true,
          subheader: "",
          buttonLabel: "Send",
        },
        {
          id: "mao94214zoo6c1at5rpuz7io",
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>We\'d love to keep you as a customer. Happy to offer a 30% discount for the next year.</span></p>',
          type: QuestionType.CTA,
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
          type: QuestionType.OpenText,

          logic: [{ condition: "submitted", destination: "end" }],
          headline: "What features are you missing?",
          required: true,
          subheader: "",
        },
        {
          id: "hdftsos1odzjllr7flj4m3j9",
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>We aim to provide the best possible customer service. Please email our CEO and she will personally handle your issue.</span></p>',
          type: QuestionType.CTA,
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
    },
  },
  {
    name: "Earned Advocacy Score (EAS)",
    category: "Growth",
    objectives: ["support_sales", "sharpen_marketing_messaging"],
    description:
      "The EAS is a riff off the NPS but asking for actual past behaviour instead of lofty intentions.",
    preset: {
      name: "Earned Advocacy Score (EAS)",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          logic: [{ value: "No", condition: "equals", destination: "duz2qp8eftix9wty1l221x1h" }],
          choices: [
            { id: createId(), label: "Yes" },
            { id: createId(), label: "No" },
          ],
          headline: "Have you actively recommended {{productName}} to others?",
          required: true,
          subheader: "",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "yhfew1j3ng6luy7t7qynwj79" }],
          headline: "Great to hear! Why did you recommend us?",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "duz2qp8eftix9wty1l221x1h",
          type: QuestionType.OpenText,
          headline: "So sad. Why not?",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "yhfew1j3ng6luy7t7qynwj79",
          type: QuestionType.MultipleChoiceSingle,
          logic: [{ value: "No", condition: "equals", destination: "end" }],
          choices: [
            { id: createId(), label: "Yes" },
            { id: createId(), label: "No" },
          ],
          headline: "Have you actively discouraged others from choosing {{produtName}}?",
          required: true,
          subheader: "",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "What made you discourage them?",
          required: true,
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Improve Trial Conversion",
    category: "Increase Revenue",
    objectives: ["increase_user_adoption", "increase_conversion", "improve_user_retention"],
    description: "Find out why people stopped their trial. These insights help you improve your funnel.",
    preset: {
      name: "Improve Trial Conversion",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
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
            { value: "I was just looking around", condition: "equals", destination: "end" },
          ],
          choices: [
            { id: createId(), label: "I didn't get much value out of it" },
            { id: createId(), label: "I expected something else" },
            { id: createId(), label: "It's too expensive for what it does" },
            { id: createId(), label: "I am missing a feature" },
            { id: createId(), label: "I was just looking around" },
          ],
          headline: "Why did you stop your trial?",
          required: true,
          subheader: "Help us understand you better:",
        },
        {
          id: "aew2ymg51mffnt9db7duz9t3",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "bqiyml1ym74ggx6htwdo7rlu" }],
          headline: "Sorry to hear. What was the biggest problem using {{productName}}?",
          required: true,
          buttonLabel: "Next",
        },
        {
          id: "rnrfydttavtsf2t2nfx1df7m",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "bqiyml1ym74ggx6htwdo7rlu" }],
          headline: "What did you expect {{productName}} would do for you?",
          required: true,
          buttonLabel: "Next",
        },
        {
          id: "x760wga1fhtr1i80cpssr7af",
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>We\'re happy to offer you a 20% discount on a yearly plan.</span></p>',
          type: QuestionType.CTA,
          logic: [{ condition: "clicked", destination: "end" }],
          headline: "Sorry to hear! Get 20% off the first year.",
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: "Get 20% off",
          buttonExternal: true,
          dismissButtonLabel: "Skip",
        },
        {
          id: "rbhww1pix03r6sl4xc511wqg",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "bqiyml1ym74ggx6htwdo7rlu" }],
          headline: "Which features are you missing?",
          required: true,
          subheader: "What would you like to achieve?",
          buttonLabel: "Next",
        },
        {
          id: "bqiyml1ym74ggx6htwdo7rlu",
          type: QuestionType.OpenText,
          logic: [
            { condition: "submitted", destination: "end" },
            { condition: "skipped", destination: "end" },
          ],
          headline: "How are you solving your problem now?",
          required: false,
          subheader: "Please name alternative solutions:",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Review Prompt",

    category: "Growth",
    objectives: ["support_sales"],
    description: "Invite users who love your product to review it publicly.",
    preset: {
      name: "Review Prompt",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          logic: [{ value: 3, condition: "lessEqual", destination: "tk9wpw2gxgb8fa6pbpp3qq5l" }],
          range: 5,
          scale: "star",
          headline: "How do you like {{productName}}?",
          required: true,
          subheader: "",
          lowerLabel: "",
          upperLabel: "",
        },
        {
          id: createId(),
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>This helps us a lot.</span></p>',
          type: QuestionType.CTA,
          logic: [{ condition: "clicked", destination: "end" }],
          headline: "Happy to hear 🙏 Please write a review for us!",
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: "Write review",
          buttonExternal: true,
        },
        {
          id: "tk9wpw2gxgb8fa6pbpp3qq5l",
          type: QuestionType.OpenText,
          headline: "Sorry to hear! What is ONE thing we can do better?",
          required: true,
          subheader: "Help us improve your experience.",
          buttonLabel: "Send",
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Interview Prompt",

    category: "Exploration",
    objectives: ["improve_user_retention"],
    description: "Invite a specific subset of your users to schedule an interview with your product team.",
    preset: {
      name: "Interview Prompt",
      questions: [
        {
          id: createId(),
          type: QuestionType.CTA,
          headline: "Do you have 15 min to talk to us? 🙏",
          html: "You're one of our power users. We would love to interview you briefly!",
          buttonLabel: "Book slot",
          buttonUrl: "https://cal.com/johannes",
          buttonExternal: true,
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Reduce Onboarding Drop-Off",
    category: "Product Experience",
    objectives: ["increase_user_adoption", "increase_conversion"],
    description: "Identify weaknesses in your onboarding flow to increase user activation.",
    preset: {
      name: "Onboarding Drop-Off Reasons",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
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
            { value: "Something else", condition: "equals", destination: "c0exdyri3erugrv0ezkyseh6" },
          ],
          choices: [
            { id: createId(), label: "Didn't seem useful to me" },
            { id: createId(), label: "Difficult to set up or use" },
            { id: createId(), label: "Lacked features/functionality" },
            { id: createId(), label: "Just haven't had the time" },
            { id: createId(), label: "Something else" },
          ],
          headline: "What's the main reason why you haven't finished setting up {{productName}}?",
          required: true,
          subheader: "",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "What made you think {{productName}} wouldn't be useful?",
          required: true,
          subheader: "",
          placeholder: "Type your answer here...",
        },
        {
          id: "r0zvi3vburf4hm7qewimzjux",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "What was difficult about setting up or using {{productName}}?",
          required: true,
          subheader: "",
          placeholder: "Type your answer here...",
        },
        {
          id: "rbwz3y6y9avzqcfj30nu0qj4",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "What features or functionality were missing?",
          required: true,
          subheader: "",
          placeholder: "Type your answer here...",
        },
        {
          id: "gn6298zogd2ipdz7js17qy5i",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "How could we make it easier for you to get started?",
          required: true,
          subheader: "",
          placeholder: "Type your answer here...",
        },
        {
          id: "c0exdyri3erugrv0ezkyseh6",
          type: QuestionType.OpenText,
          logic: [],
          headline: "What was it? Please explain:",
          required: false,
          subheader: "We're eager to fix it asap.",
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Uncover Strengths & Weaknesses",
    category: "Growth",
    objectives: ["sharpen_marketing_messaging", "improve_user_retention"],
    description: "Find out what users like and don't like about your product or offering.",
    preset: {
      name: "Uncover Strengths & Weaknesses",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          choices: [
            { id: createId(), label: "Ease of use" },
            { id: createId(), label: "Good value for money" },
            { id: createId(), label: "It's open-source" },
            { id: createId(), label: "The founders are cute" },
            { id: "other", label: "Other" },
          ],
          headline: "What do you value most about {{productName}}?",
          required: true,
          subheader: "",
        },
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          choices: [
            { id: createId(), label: "Documentation" },
            { id: createId(), label: "Customizability" },
            { id: createId(), label: "Pricing" },
            { id: "other", label: "Other" },
          ],
          headline: "What should we improve on?",
          required: true,
          subheader: "Please select one of the following options:",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "Would you like to add something?",
          required: false,
          subheader: "Feel free to speak your mind, we do too.",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Product Market Fit Survey (Short)",
    category: "Product Experience",
    description: "Measure PMF by assessing how disappointed users would be if your product disappeared.",
    preset: {
      name: "Product Market Fit Survey (Short)",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "How disappointed would you be if you could no longer use {{productName}}?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Not at all disappointed",
            },
            {
              id: createId(),
              label: "Somewhat disappointed",
            },
            {
              id: createId(),
              label: "Very disappointed",
            },
          ],
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "How can we improve {{productName}} for you?",
          subheader: "Please be as specific as possible.",
          required: true,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Marketing Attribution",

    category: "Growth",
    objectives: ["increase_conversion", "sharpen_marketing_messaging"],
    description: "How did you first hear about us?",
    preset: {
      name: "Marketing Attribution",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "How did you hear about us first?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Recommendation",
            },
            {
              id: createId(),
              label: "Social Media",
            },
            {
              id: createId(),
              label: "Ads",
            },
            {
              id: createId(),
              label: "Google Search",
            },
            {
              id: createId(),
              label: "In a Podcast",
            },
          ],
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Changing subscription experience",

    category: "Increase Revenue",
    objectives: ["increase_conversion", "improve_user_retention"],
    description: "Find out what goes through peoples minds when changing their subscriptions.",
    preset: {
      name: "Changing subscription experience",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "How easy was it to change your plan?",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Extremely difficult",
            },
            {
              id: createId(),
              label: "It took a while, but I got it",
            },
            {
              id: createId(),
              label: "It was alright",
            },
            {
              id: createId(),
              label: "Quite easy",
            },
            {
              id: createId(),
              label: "Very easy, love it!",
            },
          ],
        },
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "Is the pricing information easy to understand?",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Yes, very clear.",
            },
            {
              id: createId(),
              label: "I was confused at first, but found what I needed.",
            },
            {
              id: createId(),
              label: "Quite complicated.",
            },
          ],
        },
      ],
      thankYouCard: thankYouCardDefault,
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
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "What's your primary goal for using {{productName}}?",
          required: true,
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
    },
  },
  {
    name: "Feature Chaser",

    category: "Product Experience",
    objectives: ["improve_user_retention"],
    description: "Follow up with users who just used a specific feature.",
    preset: {
      name: "Feature Chaser",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          range: 5,
          scale: "number",
          headline: "How important is [ADD FEATURE] for you?",
          required: true,
          lowerLabel: "Not important",
          upperLabel: "Very important",
        },
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          choices: [
            { id: createId(), label: "Aspect 1" },
            { id: createId(), label: "Aspect 2" },
            { id: createId(), label: "Aspect 3" },
            { id: createId(), label: "Aspect 4" },
          ],
          headline: "Which aspect is most important?",
          required: true,
          subheader: "",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Fake Door Follow-Up",

    category: "Exploration",
    objectives: ["increase_user_adoption"],
    description: "Follow up with users who ran into one of your Fake Door experiments.",
    preset: {
      name: "Fake Door Follow-Up",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          headline: "How important is this feature for you?",
          required: true,
          lowerLabel: "Not important",
          upperLabel: "Very important",
          range: 5,
          scale: "number",
        },
        {
          id: createId(),
          type: QuestionType.MultipleChoiceMulti,
          headline: "What should be definitely include building this?",
          required: false,
          choices: [
            {
              id: createId(),
              label: "Aspect 1",
            },
            {
              id: createId(),
              label: "Aspect 2",
            },
            {
              id: createId(),
              label: "Aspect 3",
            },
            {
              id: createId(),
              label: "Aspect 4",
            },
          ],
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Feedback Box",

    category: "Product Experience",
    objectives: ["improve_user_retention"],
    description: "Give your users the chance to seamlessly share what's on their minds.",
    preset: {
      name: "Feedback Box",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
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
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "a6c76m5oocw6xp9agf3d2tam" }],
          headline: "What's broken?",
          required: true,
          subheader: "The more detail, the better :)",
        },
        {
          id: "a6c76m5oocw6xp9agf3d2tam",
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>We will fix this as soon as possible. Do you want to be notified when we did?</span></p>',
          type: QuestionType.CTA,
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
          type: QuestionType.OpenText,
          headline: "Lovely, tell us more!",
          required: true,
          subheader: "What problem do you want us to solve?",
          buttonLabel: "Request feature",
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Integration Setup Survey",

    category: "Product Experience",
    objectives: ["increase_user_adoption"],
    description: "Evaluate how easily users can add integrations to your product. Find blind spots.",
    preset: {
      name: "Integration Usage Survey",
      questions: [
        {
          id: "s6ss6znzxdwjod1hv16fow4w",
          type: QuestionType.Rating,
          logic: [{ value: 4, condition: "greaterEqual", destination: "ef0qo3l8iisd517ikp078u1p" }],
          range: 5,
          scale: "number",
          headline: "How easy was it to set this integration up?",
          required: true,
          subheader: "",
          lowerLabel: "Not easy",
          upperLabel: "Very easy",
        },
        {
          id: "mko13ptjj6tpi5u2pl7a5drz",
          type: QuestionType.OpenText,
          headline: "Why was it hard?",
          required: false,
          placeholder: "Type your answer here...",
        },
        {
          id: "ef0qo3l8iisd517ikp078u1p",
          type: QuestionType.OpenText,
          headline: "What other tools would you like to use with {{productName}}?",
          required: false,
          subheader: "We keep building integrations, yours can be next:",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "New Integration Survey",

    category: "Exploration",
    objectives: ["increase_user_adoption", "increase_conversion"],
    description: "Find out which integrations your users would like to see next.",
    preset: {
      name: "New Integration Survey",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "Which other tools are you using?",
          required: true,
          choices: [
            {
              id: createId(),
              label: "PostHog",
            },
            {
              id: createId(),
              label: "Segment",
            },
            {
              id: createId(),
              label: "Hubspot",
            },
            {
              id: createId(),
              label: "Twilio",
            },
            { id: "other", label: "Other" },
          ],
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Docs Feedback",

    category: "Product Experience",
    objectives: ["increase_user_adoption", "improve_user_retention"],
    description: "Measure how clear each page of your developer documentation is.",
    preset: {
      name: "{{productName}} Docs Feedback",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "Was this page helpful?",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Yes 👍",
            },
            {
              id: createId(),
              label: "No 👎",
            },
          ],
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "Please elaborate:",
          required: false,
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "Page URL",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Net Promoter Score (NPS)",

    category: "Customer Success",
    objectives: ["support_sales"],
    description: "Measure the Net Promoter Score of your product.",
    preset: {
      name: "{{productName}} NPS",
      questions: [
        {
          id: createId(),
          type: QuestionType.NPS,
          headline: "How likely are you to recommend {{productName}} to a friend or colleague?",
          required: false,
          lowerLabel: "Not likely",
          upperLabel: "Very likely",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "What made you give that rating?",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Customer Satisfaction Score (CSAT)",

    category: "Customer Success",
    objectives: ["support_sales"],
    description: "Measure the Customer Satisfaction Score of your product.",
    preset: {
      name: "{{productName}} CSAT",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          logic: [{ value: 3, condition: "lessEqual", destination: "vyo4mkw4ln95ts4ya7qp2tth" }],
          range: 5,
          scale: "smiley",
          headline: "How satisfied are you with your {{productName}} experience?",
          required: true,
          subheader: "",
          lowerLabel: "Not satisfied",
          upperLabel: "Very satisfied",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "Lovely! Is there anything we can do to improve your experience?",
          required: false,
          placeholder: "Type your answer here...",
        },
        {
          id: "vyo4mkw4ln95ts4ya7qp2tth",
          type: QuestionType.OpenText,
          headline: "Ugh, sorry! Is there anything we can do to improve your experience?",
          required: false,
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Identify upsell opportunities",

    category: "Increase Revenue",
    objectives: ["support_sales", "sharpen_marketing_messaging"],
    description: "Find out how much time your product saves your user. Use it to upsell.",
    preset: {
      name: "Identify upsell opportunities",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "How many hours does your team save per week by using {{productName}}?",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Less than 1 hour",
            },
            {
              id: createId(),
              label: "1 to 2 hours",
            },
            {
              id: createId(),
              label: "3 to 5 hours",
            },
            {
              id: createId(),
              label: "5+ hours",
            },
          ],
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },

  {
    name: "Prioritize Features",

    category: "Exploration",
    objectives: ["increase_user_adoption"],
    description: "Identify features your users need most and least.",
    preset: {
      name: "Feature Prioritization",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          logic: [],
          choices: [
            { id: createId(), label: "Feature 1" },
            { id: createId(), label: "Feature 2" },
            { id: createId(), label: "Feature 3" },
            { id: "other", label: "Other" },
          ],
          headline: "Which of these features would be MOST valuable to you?",
          required: true,
          subheader: "",
        },
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          logic: [],
          choices: [
            { id: createId(), label: "Feature 1" },
            { id: createId(), label: "Feature 2" },
            { id: createId(), label: "Feature 3" },
          ],
          headline: "Which of these features would be LEAST valuable to you?",
          required: true,
          subheader: "",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "How else could we improve you experience with {{productName}}?",
          required: true,
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Gauge Feature Satisfaction",

    category: "Product Experience",
    objectives: ["increase_user_adoption", "improve_user_retention"],
    description: "Evaluate the satisfaction of specific features of your product.",
    preset: {
      name: "Gauge Feature Satisfaction",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          headline: "How easy was it to achieve ... ?",
          required: true,
          lowerLabel: "Not easy",
          upperLabel: "Very easy",
          scale: "number",
          range: 5,
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "What is one thing we could do better?",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Marketing Site Clarity",

    category: "Growth",
    objectives: ["increase_conversion", "sharpen_marketing_messaging"],
    description: "Identify users dropping off your marketing site. Improve your messaging.",
    preset: {
      name: "Marketing Site Clarity",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          headline: "Do you have all the info you need to give {{productName}} a try?",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Yes, totally",
            },
            {
              id: createId(),
              label: "Kind of...",
            },
            {
              id: createId(),
              label: "No, not at all",
            },
          ],
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "What’s missing or unclear to you about {{productName}}?",
          required: false,
        },
        {
          id: createId(),
          type: QuestionType.CTA,
          headline: "Thanks for your answer! Get 25% off your first 6 months:",
          required: false,
          buttonLabel: "Get discount",
          buttonUrl: "https://app.formbricks.com/auth/signup",
          buttonExternal: true,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Customer Effort Score (CES)",

    category: "Product Experience",
    objectives: ["increase_user_adoption", "improve_user_retention"],
    description: "Determine how easy it is to use a feature.",
    preset: {
      name: "Customer Effort Score (CES)",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          range: 5,
          scale: "number",
          headline: "{{productName}} makes it easy for me to [ADD GOAL]",
          required: true,
          subheader: "",
          lowerLabel: "Disagree strongly",
          upperLabel: "Agree strongly",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "Thanks! How could we make it easier for you to [ADD GOAL]?",
          required: true,
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },

  {
    name: "Rate Checkout Experience",

    category: "Increase Revenue",
    objectives: ["increase_conversion"],
    description: "Let customers rate the checkout experience to tweak conversion.",
    preset: {
      name: "Rate Checkout Experience",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          logic: [{ value: 4, condition: "greaterEqual", destination: "lpof3d9t9hmnqvyjlpksmxd7" }],
          range: 5,
          scale: "number",
          headline: "How easy or difficult was it to complete the checkout?",
          required: true,
          subheader: "",
          lowerLabel: "Very difficult",
          upperLabel: "Very easy",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "Sorry about that! What would have made it easier for you?",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "lpof3d9t9hmnqvyjlpksmxd7",
          type: QuestionType.OpenText,
          headline: "Lovely! Is there anything we can do to improve your experience?",
          required: true,
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Measure Search Experience",

    category: "Product Experience",
    objectives: ["improve_user_retention"],
    description: "Measure how relevant your search results are.",
    preset: {
      name: "Measure Search Experience",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          logic: [{ value: 4, condition: "greaterEqual", destination: "adcs3d9t9hmnqvyjlpksmxd7" }],
          range: 5,
          scale: "number",
          headline: "How relevant are these search results?",
          required: true,
          subheader: "",
          lowerLabel: "Not at all relevant",
          upperLabel: "Very relevant",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "Ugh! What makes the results irrelevant for you?",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "adcs3d9t9hmnqvyjlpksmxd7",
          type: QuestionType.OpenText,
          headline: "Lovely! Is there anything we can do to improve your experience?",
          required: true,
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Evaluate Content Quality",

    category: "Growth",
    objectives: ["increase_conversion"],
    description: "Measure if your content marketing pieces hit right.",
    preset: {
      name: "Evaluate Content Quality",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          logic: [{ value: 4, condition: "greaterEqual", destination: "adcs3d9t9hmnqvyjlpkswi38" }],
          range: 5,
          scale: "number",
          headline: "How well did this article address what you were hoping to learn?",
          required: true,
          subheader: "",
          lowerLabel: "Not at all well",
          upperLabel: "Extremely well",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "Hmpft! What were you hoping for?",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "adcs3d9t9hmnqvyjlpkswi38",
          type: QuestionType.OpenText,
          headline: "Lovely! Is there anything else you would like us to cover?",
          required: true,
          placeholder: "Topics, trends, tutorials...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Measure Task Accomplishment",

    category: "Customer Success",
    objectives: ["increase_user_adoption", "improve_user_retention"],
    description: "See if people get their 'Job To Be Done' done. Successful people are better customers.",
    preset: {
      name: "Measure Task Accomplishment",
      questions: [
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
          logic: [
            { value: "Working on it, boss", condition: "equals", destination: "nq88udm0jjtylr16ax87xlyc" },
            { value: "Yes", condition: "equals", destination: "rjeac33gd13h3nnbrbid1fb2" },
            { value: "No", condition: "equals", destination: "u83zhr66knyfozccoqojx7bc" },
          ],
          choices: [
            { id: createId(), label: "Yes" },
            { id: createId(), label: "Working on it, boss" },
            { id: createId(), label: "No" },
          ],
          headline: "Were you able to accomplish what you came here to do today?",
          required: true,
        },
        {
          id: "rjeac33gd13h3nnbrbid1fb2",
          type: QuestionType.Rating,
          logic: [{ value: 4, condition: "greaterEqual", destination: "nq88udm0jjtylr16ax87xlyc" }],
          range: 5,
          scale: "number",
          headline: "How easy was it to achieve your goal?",
          required: true,
          lowerLabel: "Very difficult",
          upperLabel: "Very easy",
        },
        {
          id: "s0999bhpaz8vgf7ps264piek",
          type: QuestionType.OpenText,
          logic: [
            { condition: "submitted", destination: "end" },
            { condition: "skipped", destination: "end" },
          ],
          headline: "What made it hard?",
          required: false,
          placeholder: "Type your answer here...",
        },
        {
          id: "nq88udm0jjtylr16ax87xlyc",
          type: QuestionType.OpenText,
          logic: [
            { condition: "skipped", destination: "end" },
            { condition: "submitted", destination: "end" },
          ],
          headline: "Great! What did you come here to do today?",
          required: false,
          buttonLabel: "Send",
        },
        {
          id: "u83zhr66knyfozccoqojx7bc",
          type: QuestionType.OpenText,
          headline: "What stopped you?",
          required: true,
          buttonLabel: "Send",
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Identify Sign Up Barriers",

    category: "Growth",
    objectives: ["increase_conversion"],
    description: "Offer a discount to gather insights about sign up barriers.",
    preset: {
      name: "{{productName}} Sign Up Barriers",
      questions: [
        {
          id: createId(),
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>You seem to be considering signing up. Answer four questions and get 10% on any plan.</span></p>',
          type: QuestionType.CTA,
          logic: [{ condition: "skipped", destination: "end" }],
          headline: "Answer this short survey, get 10% off!",
          required: false,
          buttonLabel: "Get 10% discount",
          buttonExternal: false,
          dismissButtonLabel: "No, thanks",
        },
        {
          id: createId(),
          type: QuestionType.Rating,
          logic: [{ value: "5", condition: "equals", destination: "end" }],
          range: 5,
          scale: "number",
          headline: "How likely are you to sign up for {{productName}}?",
          required: true,
          subheader: "",
          lowerLabel: "Not at all likely",
          upperLabel: "Very likely",
        },
        {
          id: createId(),
          type: QuestionType.MultipleChoiceSingle,
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
            { id: createId(), label: "May not have what I'm looking for" },
            { id: createId(), label: "Still comparing options" },
            { id: createId(), label: "Seems complicated" },
            { id: createId(), label: "Pricing is a concern" },
            { id: createId(), label: "Something else" },
          ],
          headline: "What is holding you back from trying {{productName}}?",
          required: true,
          subheader: "",
        },
        {
          id: "atiw0j1oykb77zr0b7q4tixu",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "k3q0vt1ko0bzbsq076p7lnys" }],
          headline: "What do you need but {{productName}} does not offer?",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "j7jkpolm5xl7u0zt3g0e4z7d",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "k3q0vt1ko0bzbsq076p7lnys" }],
          headline: "What options are you looking at?",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "t5gvag2d7kq311szz5iyiy79",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "k3q0vt1ko0bzbsq076p7lnys" }],
          headline: "What seems complicated to you?",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "or0yhhrof753sq9ug4mdavgz",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "k3q0vt1ko0bzbsq076p7lnys" }],
          headline: "What are you concerned about regarding pricing?",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "v0pq1qcnm6ohiry5ywcd91qq",
          type: QuestionType.OpenText,
          headline: "Please explain:",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "k3q0vt1ko0bzbsq076p7lnys",
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>Thanks a lot for taking the time to share feedback 🙏</span></p>',
          type: QuestionType.CTA,
          headline: "Thanks! Here is your code: SIGNUPNOW10",
          required: false,
          buttonUrl: "https://app.formbricks.com/auth/signup",
          buttonLabel: "Sign Up",
          buttonExternal: true,
          dismissButtonLabel: "Skip for now",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Build Product Roadmap",

    category: "Exploration",
    objectives: ["increase_user_adoption"],
    description: "Identify the ONE thing your users want the most and build it.",
    preset: {
      name: "{{productName} Roadmap Input",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          range: 5,
          scale: "number",
          headline: "How satisfied are you with the features and functionality of {{productName}}?",
          required: true,
          subheader: "",
          lowerLabel: "Not at all satisfied",
          upperLabel: "Extremely satisfied",
        },
        {
          id: createId(),
          type: QuestionType.OpenText,
          headline: "What's ONE change we could make to improve your {{productName}} experience most?",
          required: true,
          subheader: "",
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Understand Purchase Intention",

    category: "Increase Revenue",
    objectives: ["increase_conversion", "increase_user_adoption"],
    description: "Find out how close your visitors are to buy or subscribe.",
    preset: {
      name: "Purchase Intention Survey",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          logic: [
            { value: "2", condition: "lessEqual", destination: "y19mwcmstlc7pi7s4izxk1ll" },
            { value: "3", condition: "equals", destination: "zm1hs8qkeuidh3qm0hx8pnw7" },
            { value: "4", condition: "equals", destination: "zm1hs8qkeuidh3qm0hx8pnw7" },
            { value: "5", condition: "equals", destination: "end" },
          ],
          range: 5,
          scale: "number",
          headline: "How likely are you to subscribe to {{productName}} today?",
          required: true,
          subheader: "",
          lowerLabel: "Not at all likely",
          upperLabel: "Extremely likely",
        },
        {
          id: "y19mwcmstlc7pi7s4izxk1ll",
          type: QuestionType.OpenText,
          logic: [
            { condition: "submitted", destination: "end" },
            { condition: "skipped", destination: "end" },
          ],
          headline: "Got it. What's your primary reason for visiting today?",
          required: false,
          placeholder: "Type your answer here...",
        },
        {
          id: "zm1hs8qkeuidh3qm0hx8pnw7",
          type: QuestionType.OpenText,
          headline: "What, if anything, is holding you back from making a purchase today?",
          required: true,
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Improve Newsletter Content",

    category: "Growth",
    objectives: ["increase_conversion", "sharpen_marketing_messaging"],
    description: "Find out how your subscribers like your newsletter content.",
    preset: {
      name: "Improve Newsletter Content",
      questions: [
        {
          id: createId(),
          type: QuestionType.Rating,
          logic: [
            { value: "5", condition: "equals", destination: "l2q1chqssong8n0xwaagyl8g" },
            { value: "5", condition: "lessThan", destination: "k3s6gm5ivkc5crpycdbpzkpa" },
          ],
          range: 5,
          scale: "smiley",
          headline: "How would you rate this weeks newsletter?",
          required: true,
          subheader: "",
          lowerLabel: "Meh",
          upperLabel: "Great",
        },
        {
          id: "k3s6gm5ivkc5crpycdbpzkpa",
          type: QuestionType.OpenText,
          logic: [
            { condition: "submitted", destination: "end" },
            { condition: "skipped", destination: "end" },
          ],
          headline: "What would have made this weeks newsletter more helpful?",
          required: false,
          placeholder: "Type your answer here...",
        },
        {
          id: "l2q1chqssong8n0xwaagyl8g",
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>Who thinks like you? You\'d do us a huge favor if you\'d share this weeks episode with your brain friend!</span></p>',
          type: QuestionType.CTA,
          headline: "Thanks! ❤️ Spread the love with ONE friend.",
          required: false,
          buttonUrl: "https://formbricks.com",
          buttonLabel: "Happy to help!",
          buttonExternal: true,
          dismissButtonLabel: "Find your own friends",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Evaluate a Product Idea",

    category: "Exploration",
    objectives: ["improve_user_retention", "increase_user_adoption"],
    description: "Survey users about product or feature ideas. Get feedback rapidly.",
    preset: {
      name: "Evaluate a Product Idea",
      questions: [
        {
          id: createId(),
          html: '<p class="fb-editor-paragraph" dir="ltr"><span>We respect your time and kept it short 🤸</span></p>',
          type: QuestionType.CTA,
          headline:
            "We love how you use {{productName}}! We'd love to pick your brain on a feature idea. Got a minute?",
          required: true,
          buttonLabel: "Let's do it!",
          buttonExternal: false,
          dismissButtonLabel: "Skip",
        },
        {
          id: createId(),
          type: QuestionType.Rating,
          logic: [
            { value: "3", condition: "lessEqual", destination: "ndacjg9lqf5jcpq9w8ote666" },
            { value: "4", condition: "greaterEqual", destination: "jmzgbo73cfjswlvhoynn7o0q" },
          ],
          range: 5,
          scale: "number",
          headline: "Thanks! How difficult or easy is it for you to [PROBLEM AREA] today?",
          required: true,
          subheader: "",
          lowerLabel: "Very difficult",
          upperLabel: "Very easy",
        },
        {
          id: "ndacjg9lqf5jcpq9w8ote666",
          type: QuestionType.OpenText,
          headline: "What's most difficult for you when it comes to [PROBLEM AREA]?",
          required: true,
          subheader: "",
          placeholder: "Type your answer here...",
        },
        {
          id: "jmzgbo73cfjswlvhoynn7o0q",
          html: '<p class="fb-editor-paragraph"><br></p><p class="fb-editor-paragraph" dir="ltr"><b><strong class="fb-editor-text-bold">Read the text below, then answer 2 questions:</strong></b></p><p class="fb-editor-paragraph"><br></p><p class="fb-editor-paragraph" dir="ltr"><span>Insert concept brief here. Add neccessary details but keep it concise and easy to understand.</span></p>',
          type: QuestionType.CTA,
          headline: "We're working on an idea to help with [PROBLEM AREA].",
          required: true,
          buttonLabel: "Next",
          buttonExternal: false,
          dismissButtonLabel: "Skip",
        },
        {
          id: createId(),
          type: QuestionType.Rating,
          logic: [
            { value: "3", condition: "lessEqual", destination: "mmiuun3z4e7gk4ufuwh8lq8q" },
            { value: "4", condition: "greaterEqual", destination: "gvzevzw4hkqd6dmlkcly6kd1" },
          ],
          range: 5,
          scale: "number",
          headline: "How valuable would this feature be to you?",
          required: true,
          subheader: "",
          lowerLabel: "Not valuable",
          upperLabel: "Very valuable",
        },
        {
          id: "mmiuun3z4e7gk4ufuwh8lq8q",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "bqmnpyku9etsgbtb322luzb2" }],
          headline: "Got it. Why wouldn't this feature be valuable to you?",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "gvzevzw4hkqd6dmlkcly6kd1",
          type: QuestionType.OpenText,
          headline: "Got it. What would be most valuable to you in this feature?",
          required: true,
          placeholder: "Type your answer here...",
        },
        {
          id: "bqmnpyku9etsgbtb322luzb2",
          type: QuestionType.OpenText,
          headline: "Anything else we should keep in mind?",
          required: false,
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Understand Low Engagement",

    category: "Product Experience",
    objectives: ["improve_user_retention", "increase_user_adoption"],
    description: "Identify reasons for low engagement to improve user adoption.",
    preset: {
      name: "Reasons for Low Engagement",
      questions: [
        {
          id: "aq9dafe9nxe0kpm67b1os2z9",
          type: QuestionType.MultipleChoiceSingle,
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
            { id: "xoqb0wjjsk4t0lx0i7jrhx26", label: "Difficult to use" },
            { id: "p768nlw47ndehtgzx6m82dr6", label: "Found a better alternative" },
            { id: "izt28ma5ep3s92531owxj1vg", label: "Just haven't had the time" },
            { id: "dhkp2wb9e1tv7kfu8csjhzbh", label: "Lacked features I need" },
            { id: "other", label: "Other" },
          ],
          headline: "What's the main reason you haven't been back to {{productName}} recently?",
          required: true,
          subheader: "",
        },
        {
          id: "r0zvi3vburf4hm7qewimzjux",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "What's difficult about using {{productName}}?",
          required: true,
          subheader: "",
          placeholder: "Type your answer here...",
        },
        {
          id: "g92s5wetp51ps6afmc6y7609",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "Got it. Which alternative are you using instead?",
          required: true,
          subheader: "",
          placeholder: "Type your answer here...",
        },
        {
          id: "gn6298zogd2ipdz7js17qy5i",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "Got it. How could we make it easier for you to get started?",
          required: true,
          subheader: "",
          placeholder: "Type your answer here...",
        },
        {
          id: "rbwz3y6y9avzqcfj30nu0qj4",
          type: QuestionType.OpenText,
          logic: [{ condition: "submitted", destination: "end" }],
          headline: "Got it. What features or functionality were missing?",
          required: true,
          subheader: "",
          placeholder: "Type your answer here...",
        },
        {
          id: "c0exdyri3erugrv0ezkyseh6",
          type: QuestionType.OpenText,
          logic: [],
          headline: "Please add more details:",
          required: false,
          subheader: "",
          placeholder: "Type your answer here...",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },

  /* {
    name: "TEMPLATE MASTER",

    category: "X",
    objectives: ["X"],
    description: "X",
    preset: {
      name: "X",
      questions: [
        {
          id: createId(),
          type: "X",
          headline: "X",
          required: false,
          lowerLabel: "Not likely",
          upperLabel: "Very likely",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },  */
];

export const customSurvey: Template = {
  name: "Start from scratch",
  description: "Create a survey without template.",
  preset: {
    name: "New Survey",
    questions: [
      {
        id: createId(),
        type: QuestionType.OpenText,
        headline: "Custom Survey",
        subheader: "This is an example survey.",
        placeholder: "Type your answer here...",
        required: true,
      },
    ],
    thankYouCard: thankYouCardDefault,
  },
};
