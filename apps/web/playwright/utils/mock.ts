export const users = {
  signup: [
    {
      name: "SignUp Flow User 1",
      email: "signup1@formbricks.com",
      password: "eN791hZ7wNr9IAscf@",
    },
  ],
  onboarding: [
    {
      name: "Onboarding User 1",
      email: "onboarding1@formbricks.com",
      password: "iHalLonErFGK$X901R0",
    },
    {
      name: "Onboarding User 2",
      email: "onboarding2@formbricks.com",
      password: "231Xh7D&dM8u75EjIYV",
    },
  ],
  survey: [
    {
      name: "Survey User 1",
      email: "survey1@formbricks.com",
      password: "Y1I*EpURUSb32j5XijP",
    },
    {
      name: "Survey User 2",
      email: "survey2@formbricks.com",
      password: "G73*Gjif22F4JKM1pA",
    },
    {
      name: "Survey User 3",
      email: "survey3@formbricks.com",
      password: "Gj2DGji27D&M8u53V",
    },
  ],
  js: [
    {
      name: "JS User 1",
      email: "js1@formbricks.com",
      password: "XpP%X9UU3efj8vJa",
    },
  ],
  action: [
    {
      name: "Action User 1",
      email: "action1@formbricks.com",
      password: "XpP%X9UU3efj8vJa",
    },
    {
      name: "Action User 2",
      email: "action2@formbricks.com",
      password: "XpP%X9UU3efj8vJa",
    },
    {
      name: "Action User 3",
      email: "action3@formbricks.com",
      password: "XpP%X9UU3efj8vJa",
    },
    {
      name: "Action User 4",
      email: "action4@formbricks.com",
      password: "XpP%X9UU3efj8vJa",
    },
    {
      name: "Action User 5",
      email: "action5@formbricks.com",
      password: "XpP%X9UU3efj8vJa",
    },
  ],
  team: [
    {
      name: "Team User 1",
      email: "team1@formbricks.com",
      password: "Test#1234",
    },
    {
      name: "Team User 2",
      email: "team2@formbricks.com",
      password: "Test#1234",
    },
  ],
};

export const teams = {
  onboarding: [
    {
      role: "Founder",
      useCase: "Increase conversion",
      productName: "My Product",
    },
  ],
};

export const surveys = {
  createAndSubmit: {
    welcomeCard: {
      headline: "Welcome to My Testing Survey Welcome Card!",
      description: "This is the description of my Welcome Card!",
    },
    openTextQuestion: {
      question: "This is my Open Text Question",
      description: "This is my Open Text Description",
      placeholder: "This is my Placeholder",
    },
    singleSelectQuestion: {
      question: "This is my Single Select Question",
      description: "This is my Single Select Description",
      options: ["Option 1", "Option 2"],
    },
    multiSelectQuestion: {
      question: "This is my Multi Select Question",
      description: "This is Multi Select Description",
      options: ["Option 1", "Option 2", "Option 3"],
    },
    ratingQuestion: {
      question: "This is my Rating Question",
      description: "This is Rating Description",
      lowLabel: "My Lower Label",
      highLabel: "My Upper Label",
    },
    npsQuestion: {
      question: "This is my NPS Question",
      lowLabel: "My Lower Label",
      highLabel: "My Upper Label",
    },
    ctaQuestion: {
      question: "This is my CTA Question",
      buttonLabel: "My Button Label",
    },
    consentQuestion: {
      question: "This is my Consent Question",
      checkboxLabel: "My Checkbox Label",
    },
    pictureSelectQuestion: {
      question: "This is my Picture Select Question",
      description: "This is Picture Select Description",
    },
    fileUploadQuestion: {
      question: "This is my File Upload Question",
    },
    thankYouCard: {
      headline: "This is my Thank You Card Headline!",
      description: "This is my Thank you Card Description!",
    },
  },
};

export type CreateSurveyParams = typeof surveys.createAndSubmit;

export const actions = {
  create: {
    noCode: {
      cssSelector: {
        name: "Create Action (CSS Selector)",
        description: "This is my Create Action (CSS Selector)",
        selector: ".my-custom-class",
      },
      pageURL: {
        name: "Create Action (Page URL)",
        description: "This is my Create Action (Page URL)",
        matcher: {
          label: "Starts with",
          value: "custom-url",
        },
        testURL: "http://localhost:3000/custom-url",
      },
      innerText: {
        name: "Create Action (Inner Text)",
        description: "This is my Create Action (Inner Text)",
        innerText: "Download",
      },
    },
    code: {
      name: "Create Action (Code)",
      description: "This is my Create Action (Code)",
    },
  },
  edit: {
    noCode: {
      cssSelector: {
        name: "Edit Action (CSS Selector)",
        description: "This is my Edit Action (CSS Selector)",
        selector: ".my-custom-class-edited",
      },
      pageURL: {
        name: "Edit Action (Page URL)",
        description: "This is my Edit Action (Page URL)",
        matcher: {
          label: "Starts with",
          value: "custom-url0-edited",
        },
        testURL: "http://localhost:3000/custom-url",
      },
      innerText: {
        name: "Edit Action (Inner Text)",
        description: "This is my Edit Action (Inner Text)",
        innerText: "Download Edited",
      },
    },
    code: {
      description: "This is my Edit Action (Code)",
    },
  },
  delete: {
    noCode: {
      name: "Delete Action (CSS Selector)",
      description: "This is my Delete Action (CSS Selector)",
      selector: ".my-custom-class-deleted",
    },
    code: {
      name: "Delete Action (Code)",
      description: "This is my Delete Action (Code)",
    },
  },
};

export const invites = {
  addMember: {
    name: "Team User 2",
    email: "team2@formbricks.com",
  },
};
