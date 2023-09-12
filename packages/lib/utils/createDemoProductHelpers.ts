import { NoCodeConfig } from "@formbricks/types/events";
import { QuestionType } from "@formbricks/types/questions";
import { createId } from "@paralleldrive/cuid2";
import { EventType } from "@prisma/client";

export const populateEnvironment = {
  eventClasses: {
    create: [
      {
        name: "New Session",
        description: "Gets fired when a new session is created",
        type: EventType.automatic,
      },
      {
        name: "Exit Intent (Desktop)",
        description: "A user on Desktop leaves the website with the cursor.",
        type: EventType.automatic,
      },
      {
        name: "50% Scroll",
        description: "A user scrolled 50% of the current page",
        type: EventType.automatic,
      },
    ],
  },
  attributeClasses: {
    create: [
      { name: "userId", description: "The internal ID of the person", type: EventType.automatic },
      { name: "email", description: "The email of the person", type: EventType.automatic },
    ],
  },
};

type TUpdateEnvironmentArgs = {
  eventClasses: {
    create: {
      name: string;
      description: string;
      type: EventType;
      noCodeConfig?: NoCodeConfig;
    }[];
  };
  attributeClasses: {
    create: {
      name: string;
      description: string;
      type: EventType;
    }[];
  };
};

export const updateEnvironmentArgs: TUpdateEnvironmentArgs = {
  eventClasses: {
    create: [
      {
        name: "Created New Event",
        description: "Person created a new event",
        type: EventType.code,
      },
      {
        name: "Updated Availability",
        description: "Person updated their availability",
        type: EventType.code,
      },
      {
        name: "Received Booking Request",
        description: "Person received a booking request",
        type: EventType.code,
      },
      {
        name: "Invited Team Member",
        description: "Person invited a team member",
        type: EventType.noCode,
        noCodeConfig: { type: "innerHtml", innerHtml: { value: "Add Team Member" } },
      },
      {
        name: "Created New Workflow",
        description: "Person setup a new workflow",
        type: EventType.noCode,
        noCodeConfig: { type: "innerHtml", innerHtml: { value: "Create Workflow" } },
      },
      {
        name: "Viewed Insight",
        description: "Person viewed the insights dashboard",
        type: EventType.noCode,
        noCodeConfig: { type: "pageUrl", pageUrl: { rule: "contains", value: "insights" } },
      },
    ],
  },
  attributeClasses: {
    create: [
      {
        name: "Name",
        description: "Full Name of the Person",
        type: EventType.code,
      },
      {
        name: "Role",
        description: "Current role of the person",
        type: EventType.code,
      },
      {
        name: "Company",
        description: "The company they work at",
        type: EventType.code,
      },
      {
        name: "Experience",
        description: "Level of experience of the person",
        type: EventType.code,
      },
      {
        name: "Usage Frequency",
        description: "Frequency of product usage",
        type: EventType.automatic,
      },
      {
        name: "Company Size",
        description: "Company size",
        type: EventType.code,
      },
      {
        name: "Product Satisfaction Score",
        description: "Level of product satisfaction of the person",
        type: EventType.automatic,
      },
      {
        name: "Recommendation Likelihood",
        description: "Likehood of recommending the product",
        type: EventType.automatic,
      },
    ],
  },
};

export const DEMO_NAMES = [
  "Wei Zhu",
  "Akiko Yamada",
  "Elena Petrova",
  "Sophia Johnson",
  "Jorge Sanchez",
  "Fatima Al Zahra",
  "Ravi Kumar",
  "Maria Silva",
  "Amahle Dlamini",
  "Antonio García",
  "Leon Müller",
  "Chloe Lefevre",
  "Alessia Rossi",
  "Eva Svendsen",
  "Sara Eriksson",
  "Liam O'Brien",
  "Anastasia Sokolova",
  "Yara van der Heijden",
  "Zeynep Gündoğan",
  "Gabriella Mészáros",
];

export const DEMO_COMPANIES = [
  "Google",
  "Apple",
  "Microsoft",
  "Amazon",
  "Facebook",
  "Tesla",
  "Netflix",
  "Oracle",
  "Adobe",
  "IBM",
  "McDonald's",
  "Coca-Cola",
  "Pepsi",
  "Samsung",
  "Intel",
  "Nvidia",
  "Visa",
  "MasterCard",
  "Paypal",
  "Spotify",
];

// A function to generate attribute values based on attribute class name, person's name, and company information
export function generateAttributeValue(
  attributeClassName: string,
  name: string,
  company: string,
  domain: string,
  i: number
): string {
  switch (attributeClassName) {
    case "userId":
      return `CYO${Math.floor(Math.random() * 999)}`; // Company size from 0 to 5000 employees
    case "email":
      return `${name.split(" ")[0].toLowerCase()}@${domain}`;
    case "Name":
      return name;
    case "Role":
      const roles = ["Manager", "Employee", "Developer", "Designer", "Product Manager", "Marketing"];
      return roles[i % roles.length]; // This ensures even distribution of roles among the people
    case "Experience":
      return `${Math.floor(Math.random() * 11)} years`; // Experience from 0 to 10 years
    case "Usage Frequency":
      const frequencies = ["Daily", "Weekly", "Monthly", "Yearly"];
      return frequencies[i % frequencies.length]; // This ensures even distribution of frequencies among the people
    case "Company Size":
      return `${Math.floor(Math.random() * 5001)} employees`; // Company size from 0 to 5000 employees
    case "Product Satisfaction Score":
      return `${Math.floor(Math.random() * 101)}`; // Satisfaction score from 0 to 100
    case "Recommendation Likelihood":
      return `${Math.floor(Math.random() * 11)}`; // Likelihood from 0 to 10
    case "Company":
      return company;
    default:
      return "Unknown";
  }
}

export const PMFSurvey = {
  name: "Product Market Fit",
  type: "web",
  status: "inProgress",
  questions: [
    {
      id: "survey-cta",
      html: "We would love to understand your user experience better. Sharing your insight helps a lot!",
      type: QuestionType.CTA,
      logic: [{ condition: "skipped", destination: "end" }],
      headline: "You are one of our power users! Do you have 5 minutes?",
      required: false,
      buttonLabel: "Happy to help!",
      buttonExternal: false,
      dismissButtonLabel: "No, thanks.",
    },
    {
      id: "disappointment-score",
      type: QuestionType.MultipleChoiceSingle,
      headline: "How disappointed would you be if you could no longer use CalendYo?",
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
      id: "roles",
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
      id: "who-benefits-most",
      type: QuestionType.OpenText,
      headline: "What type of people do you think would most benefit from CalendYo?",
      required: true,
    },
    {
      id: "main-benefit",
      type: QuestionType.OpenText,
      headline: "What is the main benefit your receive from CalendYo?",
      required: true,
    },
    {
      id: "improve-demo",
      type: QuestionType.OpenText,
      headline: "How can we improve CalendYo for you?",
      subheader: "Please be as specific as possible.",
      required: true,
    },
  ],
};

export const PMFResponses = [
  {
    roles: "Software Engineer",
    "survey-cta": "clicked",
    "improve-demo": "Integration with more third-party apps would be great",
    "main-benefit": "Allows for seamless coordination between different time zones",
    "who-benefits-most": "Freelancers who work with international clients",
    "disappointment-score": "Very disappointed",
  },
  {
    roles: "Founder",
    "survey-cta": "clicked",
    "improve-demo": "I'd love to see an offline mode",
    "main-benefit": "Streamlines the appointment scheduling process saving us hours each week",
    "who-benefits-most": "Startup founders who juggle a lot of meetings",
    "disappointment-score": "Very disappointed",
  },
  {
    roles: "Product Manager",
    "survey-cta": "clicked",
    "improve-demo": "User interface could be more intuitive",
    "main-benefit": "Allows for easy scheduling and rescheduling of team meetings",
    "who-benefits-most": "Project managers with large teams",
    "disappointment-score": "Somewhat disappointed",
  },
  {
    roles: "Product Owner",
    "survey-cta": "clicked",
    "improve-demo": "An option to add more personalized messages would be great",
    "main-benefit": "Allows clients to schedule meetings according to their convenience",
    "who-benefits-most": "Consultants who manage multiple clients",
    "disappointment-score": "Very disappointed",
  },
  {
    roles: "Software Engineer",
    "survey-cta": "clicked",
    "improve-demo": "The mobile app could use some improvements",
    "main-benefit": "Takes care of scheduling so I can focus more on coding",
    "who-benefits-most": "Developers in a distributed team",
    "disappointment-score": "Somewhat disappointed",
  },
  {
    roles: "Executive",
    "survey-cta": "clicked",
    "improve-demo": "A group scheduling feature would be nice",
    "main-benefit": "Simplifies managing my busy schedule",
    "who-benefits-most": "Executives with back-to-back meetings",
    "disappointment-score": "Very disappointed",
  },
  {
    roles: "Product Manager",
    "survey-cta": "clicked",
    "improve-demo": "Maybe a lighter theme for the UI?",
    "main-benefit": "A unified view of all my appointments in one place",
    "who-benefits-most": "Professionals who have to manage multiple projects",
    "disappointment-score": "Not at all disappointed",
  },
  {
    roles: "Product Owner",
    "survey-cta": "clicked",
    "improve-demo": "Add options for non-business hours scheduling for flexible work",
    "main-benefit": "Easily coordinating meetings across different departments",
    "who-benefits-most": "Teams working in shifts",
    "disappointment-score": "Very disappointed",
  },
  {
    roles: "Software Engineer",
    "survey-cta": "clicked",
    "improve-demo": "In-app notifications for upcoming meetings would be beneficial",
    "main-benefit": "Eases cross-team collaborations for product development",
    "who-benefits-most": "Developers in a cross-functional team setup",
    "disappointment-score": "Somewhat disappointed",
  },
  {
    roles: "Founder",
    "survey-cta": "clicked",
    "improve-demo": "Option for booking slots for different services would be helpful",
    "main-benefit": "Helps organize client calls without back-and-forth emails",
    "who-benefits-most": "Service-based business owners",
    "disappointment-score": "Very disappointed",
  },
  {
    roles: "Executive",
    "survey-cta": "clicked",
    "improve-demo": "More customization options for calendar integration",
    "main-benefit": "Synchronizes all my appointments in one place",
    "who-benefits-most": "Professionals juggling between different calendars",
    "disappointment-score": "Very disappointed",
  },
  {
    roles: "Product Manager",
    "survey-cta": "clicked",
    "improve-demo": "Capability to export calendar would be a great addition",
    "main-benefit": "Simplifies planning and tracking of meetings",
    "who-benefits-most": "Project managers handling multiple schedules",
    "disappointment-score": "Somewhat disappointed",
  },
  {
    roles: "Product Owner",
    "survey-cta": "clicked",
    "improve-demo": "Better handling of time zone differences would be appreciated",
    "main-benefit": "Ensures smooth coordination for product development",
    "who-benefits-most": "Product owners in a global setup",
    "disappointment-score": "Very disappointed",
  },
  {
    roles: "Software Engineer",
    "survey-cta": "clicked",
    "improve-demo": "Better error handling and alerts when conflicts occur",
    "main-benefit": "Facilitates efficient scheduling of scrum meetings",
    "who-benefits-most": "Developers in an agile team",
    "disappointment-score": "Somewhat disappointed",
  },
  {
    roles: "Founder",
    "survey-cta": "clicked",
    "improve-demo": "Adding video call links directly would be a good addition",
    "main-benefit": "Saves time in coordinating for meetings, especially investor pitches",
    "who-benefits-most": "Startups looking for investments",
    "disappointment-score": "Very disappointed",
  },
  {
    roles: "Executive",
    "survey-cta": "clicked",
    "improve-demo": "More control over look and feel for customer facing scheduling page",
    "main-benefit": "Enhances productivity by removing manual coordination",
    "who-benefits-most": "Business leaders frequently interacting with stakeholders",
    "disappointment-score": "Very disappointed",
  },
  {
    roles: "Product Manager",
    "survey-cta": "clicked",
    "improve-demo": "Better analytics for usage and peak scheduling hours",
    "main-benefit": "Easily track and manage all team meetings",
    "who-benefits-most": "Managers overseeing multiple projects",
    "disappointment-score": "Somewhat disappointed",
  },
  {
    roles: "Product Owner",
    "survey-cta": "clicked",
    "improve-demo": "Add reminders for upcoming scheduled meetings",
    "main-benefit": "Facilitates effective planning and scheduling of product reviews",
    "who-benefits-most": "Product owners overseeing product development lifecycle",
    "disappointment-score": "Very disappointed",
  },
  {
    roles: "Software Engineer",
    "survey-cta": "clicked",
    "improve-demo": "Add integrations with more project management tools",
    "main-benefit": "Helps me to align with my team and stakeholders on meeting schedules",
    "who-benefits-most": "Developers in larger teams who need to synchronize their work schedules",
    "disappointment-score": "Somewhat disappointed",
  },
  {
    roles: "Executive",
    "survey-cta": "clicked",
    "improve-demo": "Add a feature for automated meeting minutes and follow-up task assignments",
    "main-benefit": "Helps me streamline the scheduling process with different teams and stakeholders",
    "who-benefits-most": "Leaders and managers who need to effectively manage their time",
    "disappointment-score": "Very disappointed",
  },
];

export const OnboardingSurvey = {
  name: "Onboarding Survey",
  type: "web",
  status: "inProgress",
  questions: [
    {
      id: "intention",
      type: QuestionType.MultipleChoiceSingle,
      headline: "What are you here for?",
      required: true,
      choices: [
        {
          id: createId(),
          label: "Schedule calls with clients",
        },
        {
          id: createId(),
          label: "Offer self-serve appointments",
        },
        {
          id: createId(),
          label: "Organize my team internally",
        },
        {
          id: createId(),
          label: "Build scheduling into my tool",
        },
        {
          id: createId(),
          label: "Organize group meetings",
        },
      ],
    },
    {
      id: "company-size",
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
      id: "first-contact",
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
};

export const OnboardingResponses = [
  {
    intention: "Schedule calls with clients",
    "company-size": "only me",
    "first-contact": "Google Search",
  },
  {
    intention: "Offer self-serve appointments",
    "company-size": "1-5 employees",
    "first-contact": "Social Media",
  },
  {
    intention: "Organize my team internally",
    "company-size": "6-10 employees",
    "first-contact": "Recommendation",
  },
  {
    intention: "Build scheduling into my tool",
    "company-size": "only me",
    "first-contact": "Ads",
  },
  {
    intention: "Organize group meetings",
    "company-size": "11-100 employees",
    "first-contact": "In a Podcast",
  },
  {
    intention: "Schedule calls with clients",
    "company-size": "over 100 employees",
    "first-contact": "Recommendation",
  },
  {
    intention: "Offer self-serve appointments",
    "company-size": "1-5 employees",
    "first-contact": "Social Media",
  },
  {
    intention: "Organize my team internally",
    "company-size": "only me",
    "first-contact": "Social Media",
  },
  {
    intention: "Build scheduling into my tool",
    "company-size": "6-10 employees",
    "first-contact": "Social Media",
  },
  {
    intention: "Schedule calls with clients",
    "company-size": "1-5 employees",
    "first-contact": "Recommendation",
  },
  {
    intention: "Schedule calls with clients",
    "company-size": "11-100 employees",
    "first-contact": "Social Media",
  },
  {
    intention: "Offer self-serve appointments",
    "company-size": "over 100 employees",
    "first-contact": "Google Search",
  },
  {
    intention: "Organize my team internally",
    "company-size": "only me",
    "first-contact": "Recommendation",
  },
  {
    intention: "Offer self-serve appointments",
    "company-size": "1-5 employees",
    "first-contact": "Ads",
  },
  {
    intention: "Schedule calls with clients",
    "company-size": "6-10 employees",
    "first-contact": "Recommendation",
  },
  {
    intention: "Schedule calls with clients",
    "company-size": "11-100 employees",
    "first-contact": "Social Media",
  },
  {
    intention: "Offer self-serve appointments",
    "company-size": "over 100 employees",
    "first-contact": "Google Search",
  },
  {
    intention: "Organize my team internally",
    "company-size": "only me",
    "first-contact": "Recommendation",
  },
  {
    intention: "Offer self-serve appointments",
    "company-size": "1-5 employees",
    "first-contact": "Ads",
  },
  {
    intention: "Schedule calls with clients",
    "company-size": "6-10 employees",
    "first-contact": "Recommendation",
  },
];

export const ChurnSurvey = {
  name: "Churn Survey",
  type: "link",
  status: "inProgress",
  questions: [
    {
      id: "churn-reason",
      type: QuestionType.MultipleChoiceSingle,
      logic: [
        { value: "Difficult to use", condition: "equals", destination: "easier-to-use" },
        { value: "It's too expensive", condition: "equals", destination: "30-off" },
        {
          value: "I am missing features",
          condition: "equals",
          destination: "missing-features",
        },
        {
          value: "Poor customer service",
          condition: "equals",
          destination: "poor-service",
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
      id: "easier-to-use",
      type: QuestionType.OpenText,
      logic: [{ condition: "submitted", destination: "end" }],
      headline: "What would have made {{productName}} easier to use?",
      required: true,
      subheader: "",
      buttonLabel: "Send",
    },
    {
      id: "30-off",
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
      id: "missing-features",
      type: QuestionType.OpenText,

      logic: [{ condition: "submitted", destination: "end" }],
      headline: "What features are you missing?",
      required: true,
      subheader: "",
    },
    {
      id: "poor-service",
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
};

export const ChurnResponses = [
  {
    "churn-reason": "Difficult to use",
    "reason-easier-use": "Better onboarding would help, I was confused with time zone settings",
  },
  {
    "churn-reason": "Difficult to use",
    "reason-easier-use":
      "The UI could be more intuitive. I often struggled with setting up the available time slots",
  },
  {
    "churn-reason": "Difficult to use",
    "reason-easier-use": "Please make the instructions clearer on how to integrate with my Google Calendar",
  },
  {
    "churn-reason": "It's too expensive",
    "30-off": "clicked",
  },
  {
    "churn-reason": "It's too expensive",
    "30-off": "clicked",
  },
  {
    "churn-reason": "It's too expensive",
    "30-off": "clicked",
  },
  {
    "churn-reason": "I am missing features",
    "missing-features": "I would love to see more customization options for the meeting invitation emails",
  },
  {
    "churn-reason": "I am missing features",
    "missing-features": "Integration with Microsoft Teams would be very helpful for my workflow",
  },
  {
    "churn-reason": "I am missing features",
    "missing-features": "I need more advanced reporting features to better understand my meeting patterns",
  },
  {
    "churn-reason": "Poor customer service",
    "poor-service": "clicked",
  },
  {
    "churn-reason": "Poor customer service",
    "poor-service": "clicked",
  },
  {
    "churn-reason": "Poor customer service",
    "poor-service": "clicked",
  },
  {
    "churn-reason": "I just didn't need it anymore",
  },
  {
    "churn-reason": "I just didn't need it anymore",
  },
  {
    "churn-reason": "I just didn't need it anymore",
  },
  {
    "churn-reason": "I am missing features",
    "missing-features": "It would be great if the tool could automatically exclude my lunch hours",
  },
  {
    "churn-reason": "I am missing features",
    "missing-features": "More filtering options in the dashboard would make the tool more usable",
  },
  {
    "churn-reason": "Difficult to use",
    "reason-easier-use":
      "A simpler user interface would be much appreciated. The current one is a bit cluttered",
  },
  {
    "churn-reason": "It's too expensive",
    "30-off": "clicked",
  },
  {
    "churn-reason": "Poor customer service",
    "poor-service": "clicked",
  },
];

export const EASSurvey = {
  name: "Earned Advocacy Score (EAS)",
  type: "web",
  status: "completed",
  questions: [
    {
      id: "actively-recommended",
      type: QuestionType.MultipleChoiceSingle,
      logic: [{ value: "No", condition: "equals", destination: "duz2qp8eftix9wty1l221x1h" }],
      shuffleOption: "none",
      choices: [
        { id: createId(), label: "Yes" },
        { id: createId(), label: "No" },
      ],
      headline: "Have you actively recommended {{productName}} to others?",
      required: true,
      subheader: "",
    },
    {
      id: "reason-recommended",
      type: QuestionType.OpenText,
      logic: [{ condition: "submitted", destination: "yhfew1j3ng6luy7t7qynwj79" }],
      headline: "Great to hear! Why did you recommend us?",
      required: true,
      placeholder: "Type your answer here...",
    },
    {
      id: "reason-not-recommended",
      type: QuestionType.OpenText,
      headline: "So sad. Why not?",
      required: true,
      placeholder: "Type your answer here...",
    },
    {
      id: "actively-discouraged",
      type: QuestionType.MultipleChoiceSingle,
      logic: [{ value: "No", condition: "equals", destination: "end" }],
      shuffleOption: "none",
      choices: [
        { id: createId(), label: "Yes" },
        { id: createId(), label: "No" },
      ],
      headline: "Have you actively discouraged others from choosing {{productName}}?",
      required: true,
      subheader: "",
    },
    {
      id: "reason-discouraged",
      type: QuestionType.OpenText,
      headline: "What made you discourage them?",
      required: true,
      placeholder: "Type your answer here...",
    },
  ],
};

export const EASResponses = [
  {
    "actively-recommended": "Yes",
    "reason-recommended":
      "The time zone feature is a game-changer. No more time conversions for international meetings!",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "Yes",
    "reason-recommended": "The Google Calendar integration saves me so much time!",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "Yes",
    "reason-recommended": "I love how easy it is to set available time slots. Makes scheduling a breeze!",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "Yes",
    "reason-recommended": "The user interface is intuitive and easy to use. A big plus in my book.",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "No",
    "reason-not-recommended": "I've had some issues with the meeting links not working properly.",
    "actively-discouraged": "Yes",
    "reason-discouraged": "The meeting link issues can cause quite a bit of confusion and delays.",
  },
  {
    "actively-recommended": "No",
    "reason-not-recommended": "I find the pricing a bit too steep for the features offered.",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "No",
    "reason-not-recommended": "The lack of integration with Microsoft Teams is a big drawback for me.",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "Yes",
    "reason-recommended": "Being able to customize meeting invitations is a great feature.",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "Yes",
    "reason-recommended": "The customer service has been exceptional. Prompt responses and helpful advice.",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "No",
    "reason-not-recommended": "I often have trouble with the time zone settings. They're a bit confusing.",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "No",
    "reason-not-recommended": "The UI could be cleaner. It feels a bit cluttered at times.",
    "actively-discouraged": "Yes",
    "reason-discouraged": "The UI can be off-putting for some users.",
  },
  {
    "actively-recommended": "Yes",
    "reason-recommended": "I find the reporting features very insightful for managing my schedule.",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "Yes",
    "reason-recommended": "Being able to exclude my lunch hours automatically is a neat feature!",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "Yes",
    "reason-recommended": "The filtering options in the dashboard are excellent for managing my bookings.",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "No",
    "reason-not-recommended": "I've had a couple of instances where my meetings were double booked.",
    "actively-discouraged": "Yes",
    "reason-discouraged": "Double bookings can be quite embarrassing and unprofessional.",
  },
  {
    "actively-recommended": "Yes",
    "reason-recommended": "The tool is always improving and adding new features. Keeps me coming back!",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "No",
    "reason-not-recommended": "I've had some issues with my meeting notifications not going out.",
    "actively-discouraged": "Yes",
    "reason-discouraged": "It's important for a scheduling tool to send out reliable notifications.",
  },
  {
    "actively-recommended": "Yes",
    "reason-recommended": "The ability to set buffer times between meetings is a lifesaver!",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "Yes",
    "reason-recommended":
      "It's so convenient to share my scheduling link and let others pick a time that works for them.",
    "actively-discouraged": "No",
  },
  {
    "actively-recommended": "No",
    "reason-not-recommended": "I find the time slot setup a bit cumbersome.",
    "actively-discouraged": "No",
  },
];

export const InterviewPromptSurvey = {
  name: "Interview Prompt",
  type: "web",
  status: "paused",
  questions: [
    {
      id: "interview-prompt",
      type: QuestionType.CTA,
      headline: "Do you have 15 min to talk to us? 🙏",
      html: "You're one of our power users. We would love to interview you briefly!",
      buttonLabel: "Book slot",
      buttonUrl: "https://cal.com/johannes",
      buttonExternal: true,
      required: false,
    },
  ],
};

export const InterviewPromptResponses = [
  {
    "interview-prompt": "clicked",
  },
  {
    "interview-prompt": "skipped",
  },
  {
    "interview-prompt": "clicked",
  },
  {
    "interview-prompt": "skipped",
  },
  {
    "interview-prompt": "clicked",
  },
  {
    "interview-prompt": "skipped",
  },
  {
    "interview-prompt": "clicked",
  },
  {
    "interview-prompt": "skipped",
  },
  {
    "interview-prompt": "clicked",
  },
  {
    "interview-prompt": "skipped",
  },
  {
    "interview-prompt": "skipped",
  },
  {
    "interview-prompt": "skipped",
  },
  {
    "interview-prompt": "skipped",
  },
  {
    "interview-prompt": "skipped",
  },
  {
    "interview-prompt": "skipped",
  },
  {
    "interview-prompt": "skipped",
  },
];

// Define possible user agents
export const userAgents = [
  { os: "Windows", browser: "Chrome" },
  { os: "MacOS", browser: "Safari" },
  { os: "Linux", browser: "Firefox" },
  { os: "Windows", browser: "Edge" },
  { os: "iOS", browser: "Safari" },
  { os: "Android", browser: "Chrome" },
  { os: "MacOS", browser: "Chrome" },
  { os: "Windows", browser: "Firefox" },
];

// Create a function that generates responses and displays
export const generateResponsesAndDisplays = (people: { id: string }[], detailedResponses: any) => {
  const responses: any = [];
  const displays: any = [];

  people.forEach((person, index) => {
    // Each person has a 70% chance to respond to the survey
    if (Math.random() < 0.7) {
      responses.push({
        finished: true,
        data: detailedResponses[index % detailedResponses.length],
        meta: { userAgent: userAgents[Math.floor(Math.random() * userAgents.length)] },
        person: { connect: { id: person.id } },
      });
      displays.push({
        person: { connect: { id: person.id } },
        status: "responded",
      });
    } else {
      // If the person does not respond, they get a 'notResponded' status
      displays.push({
        person: { connect: { id: person.id } },
        status: "seen",
      });
    }
  });

  return { responses, displays };
};
