import type { Template } from "@formbricks/types/templates";
import {
  AppPieChartIcon,
  ArrowRightCircleIcon,
  BaseballIcon,
  CancelSubscriptionIcon,
  CashCalculatorIcon,
  CheckMarkIcon,
  CodeBookIcon,
  DashboardIcon,
  DogChaserIcon,
  DoorIcon,
  FeedbackIcon,
  InterviewPromptIcon,
  OnboardingIcon,
  PMFIcon,
  TaskListSearchIcon,
  HeartCommentIcon,
  GaugeSpeedFastIcon,
  LoadingBarIcon,
  ArrowUpRightIcon,
  UserSearchGlasIcon,
  VideoTabletAdjustIcon,
} from "@formbricks/ui";
import { createId } from "@paralleldrive/cuid2";

const thankYouCardDefault = {
  enabled: true,
  headline: "Thank you!",
  subheader: "We appreciate your time and insight.",
};

export const templates: Template[] = [
  {
    name: "Product Market Fit Survey",
    icon: PMFIcon,
    category: "Product Experience",
    objectives: ["Improve adoption", "Increase conversion"],
    description: "Measure PMF by assessing how disappointed users would be if your product disappeared.",
    preset: {
      name: "Product Market Fit Survey",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
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
          type: "multipleChoiceSingle",
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
          type: "openText",
          headline: "How can we improve our service for you?",
          subheader: "Please be as specific as possible.",
          required: true,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Onboarding Segmentation",
    icon: OnboardingIcon,
    category: "Product Experience",
    objectives: ["Improve adoption", "Increase retention"],
    description: "Learn more about who signed up to your product and why.",
    preset: {
      name: "Onboarding Segmentation",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
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
          type: "multipleChoiceSingle",
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
          type: "multipleChoiceSingle",
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
              label: "in a Podcast",
            },
          ],
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Uncover Strengths & Weaknesses",
    icon: TaskListSearchIcon,
    category: "Growth",
    objectives: ["Sharpen messaging", "Increase retention"],
    description: "Find out what users like and don't like about your product or offering.",
    preset: {
      name: "Uncover Strengths & Weaknesses",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "What do you value most about our service?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Ease of use",
            },
            {
              id: createId(),
              label: "Good value for money",
            },
            {
              id: createId(),
              label: "It's open-source",
            },
            {
              id: createId(),
              label: "The founders are pretty",
            },
          ],
        },
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "What should we improve on?",
          subheader: "Please select one of the following options:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Documentation",
            },
            {
              id: createId(),
              label: "Customizability",
            },
            {
              id: createId(),
              label: "Pricing",
            },
            {
              id: createId(),
              label: "Humbleness of founders",
            },
          ],
        },
        {
          id: createId(),
          type: "openText",
          headline: "Would you like to add something?",
          subheader: "Feel free to speak your mind, we do too.",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Marketing Attribution",
    icon: AppPieChartIcon,
    category: "Growth",
    objectives: ["Increase conversion", "Sharpen messaging"],
    description: "How did you first hear about us?",
    preset: {
      name: "Marketing Attribution",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
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
              label: "in a Podcast",
            },
          ],
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Churn Survey",
    icon: CancelSubscriptionIcon,
    category: "Increase Revenue",
    objectives: ["Sharpen messaging", "Increase retention"],
    description: "Find out why people cancel their subscriptions. These insights are pure gold!",
    preset: {
      name: "Churn Survey",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "Why did you cancel your subscription?",
          subheader: "We're sorry to see you leave. Please help us do better:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "I didn't get much value out of it",
            },
            {
              id: createId(),
              label: "It's too expensive",
            },
            {
              id: createId(),
              label: "I am missing a feature",
            },
            {
              id: createId(),
              label: "Poor customer service",
            },
            {
              id: createId(),
              label: "I just didn't need it anymore",
            },
          ],
        },
        {
          id: createId(),
          type: "openText",
          headline: "Is there something we can do to win you back?",
          subheader: "Feel free to speak your mind, we do too.",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Missed Trial Conversion",
    icon: BaseballIcon,
    category: "Increase Revenue",
    objectives: ["Improve adoption", "Increase conversion", "Increase retention"],
    description: "Find out why people stopped their trial. These insights help you improve your funnel.",
    preset: {
      name: "Missed Trial Conversion",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "Why did you stop your trial?",
          subheader: "Help us understand you better. Choose one option:",
          required: true,
          choices: [
            {
              id: createId(),
              label: "I didn't get much value out of it",
            },
            {
              id: createId(),
              label: "I expected something else",
            },
            {
              id: createId(),
              label: "It's too expensive for what it does",
            },
            {
              id: createId(),
              label: "I am missing a feature",
            },
            {
              id: createId(),
              label: "I was just looking around",
            },
          ],
        },
        {
          id: createId(),
          type: "openText",
          headline: "Did you find a better alternative? Please name it:",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Changing subscription experience",
    icon: CashCalculatorIcon,
    category: "Increase Revenue",
    objectives: ["Increase conversion", "Increase retention"],
    description: "Find out what goes through peoples minds when changing their subscriptions.",
    preset: {
      name: "Changing subscription experience",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
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
          type: "multipleChoiceSingle",
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
    name: "Measure Task Accomplishment",
    icon: CheckMarkIcon,
    category: "Product Experience",
    objectives: ["Improve adoption", "Increase retention"],
    description: "See if people get their 'Job To Be Done' done. Successful people are better customers.",
    preset: {
      name: "Measure Task Accomplishment",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "Were you able to accomplish what you came here to do today?",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Yes",
            },
            {
              id: createId(),
              label: "Working on it, boss",
            },
            {
              id: createId(),
              label: "No",
            },
          ],
        },
        {
          id: createId(),
          type: "openText",
          headline: "What did you come here to do today?",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Identify Customer Goals",
    icon: ArrowRightCircleIcon,
    category: "Product Experience",
    objectives: ["Improve adoption", "Sharpen messaging", "Increase retention"],
    description:
      "Better understand if your messaging creates the right expectations of the value your product provides.",
    preset: {
      name: "Identify Customer Goals",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
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
    icon: DogChaserIcon,
    category: "Product Experience",
    objectives: ["Increase retention"],
    description: "Follow up with users who just used a specific feature.",
    preset: {
      name: "Feature Chaser",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "How easy was it to achieve your goal?",
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
          type: "openText",
          headline: "Wanna add something?",
          subheader: "This really helps us do better!",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Fake Door Follow-Up",
    icon: DoorIcon,
    category: "Exploration",
    objectives: ["Improve adoption"],
    description: "Follow up with users who ran into one of your Fake Door experiments.",
    preset: {
      name: "Fake Door Follow-Up",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "How important is this feature for you?",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Very important",
            },
            {
              id: createId(),
              label: "Not so important",
            },
            {
              id: createId(),
              label: "I was just looking around",
            },
          ],
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Feedback Box",
    icon: FeedbackIcon,
    category: "Product Experience",
    objectives: ["Increase retention"],
    description: "Give your users the chance to seamlessly share what's on their minds.",
    preset: {
      name: "Feedback Box",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "What's on your mind, boss?",
          subheader: "Thanks for sharing. We'll get back to you asap.",
          required: true,
          choices: [
            {
              id: createId(),
              label: "Bug report 🐞",
            },
            {
              id: createId(),
              label: "Feature Request 💡",
            },
          ],
        },
        {
          id: createId(),
          type: "openText",
          headline: "Give us the juicy details:",
          required: true,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Integration usage survey",
    icon: DashboardIcon,
    category: "Product Experience",
    objectives: ["Improve adoption", "Increase retention"],
    description: "Evaluate how easily users can add integrations to your product. Find blind spots.",
    preset: {
      name: "Integration Usage Survey",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
          headline: "How easy was it to set this integration up?",
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
          type: "openText",
          headline: "Which product would you like to integrate next?",
          subheader: "We keep building integrations. Yours can be next:",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "New integration survey",
    icon: DashboardIcon,
    category: "Exploration",
    objectives: ["Improve adoption", "Increase conversion"],
    description: "Find out which integrations your users would like to see next.",
    preset: {
      name: "New integration survey",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
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
            {
              id: createId(),
              label: "Other",
            },
          ],
        },
        {
          id: createId(),
          type: "openText",
          headline: "If you chose other, please clarify:",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Docs Feedback",
    icon: CodeBookIcon,
    category: "Product Experience",
    objectives: ["Improve adoption", "Increase retention"],
    description: "Measure how clear each page of your developer documentation is.",
    preset: {
      name: "{{productName}} Docs Feedback",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
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
          type: "openText",
          headline: "Please elaborate:",
          required: false,
        },
        {
          id: createId(),
          type: "openText",
          headline: "Page URL",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Interview Prompt",
    icon: InterviewPromptIcon,
    category: "Exploration",
    objectives: ["Increase retention"],
    description: "Invite a specific subset of your users to schedule an interview with your product team.",
    preset: {
      name: "Interview Prompt",
      questions: [
        {
          id: createId(),
          type: "cta",
          headline: "Wanna do a short 15m interview with Charly?",
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
    name: "Review Prompt",
    icon: HeartCommentIcon,
    category: "Growth",
    objectives: ["Increase conversion", "Support sales"],
    description: "Invite users who love your product to review it publicly.",
    preset: {
      name: "Review Prompt",
      questions: [
        {
          id: createId(),
          type: "cta",
          headline: "You're one of our most valued customers! Please write a review for us.",
          buttonLabel: "Write review",
          buttonUrl: "https://formbricks.com/github",
          buttonExternal: true,
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Net Promoter Score (NPS)",
    icon: GaugeSpeedFastIcon,
    category: "Customer Success",
    objectives: ["Support sales"],
    description: "Measure the Net Promoter Score of your product.",
    preset: {
      name: "{{productName}} NPS",
      questions: [
        {
          id: createId(),
          type: "nps",
          headline: "How likely are you to recommend {{productName}} to a friend or colleague?",
          required: false,
          lowerLabel: "Not likely",
          upperLabel: "Very likely",
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Identify upsell opportunities",
    icon: ArrowUpRightIcon,
    category: "Increase Revenue",
    objectives: ["Support sales", "Sharpen messaging"],
    description: "Find out how much time your product saves your user. Use it to upsell.",
    preset: {
      name: "Identify upsell opportunities",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
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
    name: "Build Product Roadmap",
    icon: LoadingBarIcon,
    category: "Product Experience",
    objectives: ["Improve adoption", "Increase retention"],
    description: "Ask how users rate your product. Identify blind spots to build your roadmap.",
    preset: {
      name: "Build Product Roadmap",
      questions: [
        {
          id: createId(),
          type: "rating",
          headline: "How satisfied are you with the features of {{productName}}?",
          required: true,
          lowerLabel: "Not satisfied",
          upperLabel: "Very satisfied",
          scale: "number",
          range: 5,
        },
        {
          id: createId(),
          type: "openText",
          headline: "What's the #1 thing you'd like to change in {{productName}}?",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Gauge Feature Satisfaction",
    icon: UserSearchGlasIcon,
    category: "Product Experience",
    objectives: ["Improve adoption", "Increase retention"],
    description: "Evaluate the satisfaction of specific features of your product.",
    preset: {
      name: "Gauge Feature Satisfaction",
      questions: [
        {
          id: createId(),
          type: "rating",
          headline: "How easy was it to achieve ... ?",
          required: true,
          lowerLabel: "Not easy",
          upperLabel: "Very easy",
          scale: "number",
          range: 5,
        },
        {
          id: createId(),
          type: "openText",
          headline: "What is one thing we could do better?",
          required: false,
        },
      ],
      thankYouCard: thankYouCardDefault,
    },
  },
  {
    name: "Marketing Site Clarity",
    icon: VideoTabletAdjustIcon,
    category: "Growth",
    objectives: ["Increase conversion", "Sharpen messaging"],
    description: "Identify users dropping off your marketing site. Improve your messaging.",
    preset: {
      name: "Marketing Site Clarity",
      questions: [
        {
          id: createId(),
          type: "multipleChoiceSingle",
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
          type: "openText",
          headline: "What’s missing or unclear to you about {{productName}}?",
          required: false,
        },
        {
          id: createId(),
          type: "cta",
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
];

export const customSurvey: Template = {
  name: "Custom Survey",
  description: "Create your survey from scratch.",
  icon: null,
  preset: {
    name: "New Survey",
    questions: [
      {
        id: createId(),
        type: "openText",
        headline: "What's poppin?",
        subheader: "This can help us improve your experience.",
        placeholder: "Type your answer here...",
        required: true,
      },
    ],
    thankYouCard: thankYouCardDefault,
  },
};
