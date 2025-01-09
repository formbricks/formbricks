export const mockUsers = {
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
    {
      name: "Onboarding User 3",
      email: "onboarding3@formbricks.com",
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
    {
      name: "Survey User 4",
      email: "survey4@formbricks.com",
      password: "UU3efj8vJa&M8u5M1",
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
    },
    {
      name: "Action User 2",
      email: "action2@formbricks.com",
    },
    {
      name: "Action User 3",
      email: "action3@formbricks.com",
    },
    {
      name: "Action User 4",
      email: "action4@formbricks.com",
    },
    {
      name: "Action User 5",
      email: "action5@formbricks.com",
    },
    {
      name: "Action User 6",
      email: "action6@formbricks.com",
    },
  ],
  organization: [
    {
      name: "Organization User 1",
      email: "organization1@formbricks.com",
    },
    {
      name: "Organization User 2",
      email: "organization2@formbricks.com",
    },
  ],
};

export const organizations = {
  onboarding: [
    {
      role: "Founder",
      useCase: "Increase conversion",
      projectName: "My Project",
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
    dateQuestion: {
      question: "This is my Date Question",
    },
    fileUploadQuestion: {
      question: "This is my File Upload Question",
    },
    matrix: {
      question: "How much do you love these flowers?",
      description: "0: Not at all, 3: Love it",
      rows: ["Roses", "Trees", "Ocean"],
      columns: ["0", "1", "2", "3"],
    },
    address: {
      question: "Where do you live?",
      placeholder: {
        addressLine1: "Address Line 1",
        city: "City",
        zip: "Zip",
      },
    },
    contactInfo: {
      question: "Contact Info",
      placeholder: "First Name",
    },
    ranking: {
      question: "What is most important for you in life?",
      choices: ["Work", "Money", "Travel", "Family", "Friends"],
    },
    thankYouCard: {
      headline: "This is my Thank You Card Headline!",
      description: "This is my Thank you Card Description!",
    },
  },
  createWithLogicAndSubmit: {
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
    date: {
      question: "This is my Date Question",
    },
    cal: {
      question: "This is my cal Question",
    },
    matrix: {
      question: "This is my Matrix Question",
      description: "0: Not at all, 3: Love it",
      rows: ["Roses", "Trees", "Ocean"],
      columns: ["0", "1", "2", "3"],
    },
    address: {
      question: "Where do you live?",
      placeholder: {
        addressLine1: "Address Line 1",
        city: "City",
        zip: "Zip",
      },
    },
    ranking: {
      question: "This is my Ranking Question",
      choices: ["Work", "Money", "Travel", "Family", "Friends"],
    },
    thankYouCard: {
      headline: "This is my Thank You Card Headline!",
      description: "This is my Thank you Card Description!",
    },
  },
  germanCreate: {
    next: "Weiter",
    back: "Zurück",
    welcomeCard: {
      headline: "Willkommen zu meiner Testumfrage Willkommenskarte!", // German translation
      description: "Dies ist die Beschreibung meiner Willkommenskarte!", // German translation
      buttonLabel: "Weiter",
    },
    openTextQuestion: {
      question: "Dies ist meine offene Textfrage", // German translation
      description: "Dies ist meine Beschreibung zum offenen Text", // German translation
      placeholder: "Dies ist mein Platzhalter", // German translation
    },
    singleSelectQuestion: {
      question: "Dies ist meine Einzelauswahlfrage", // German translation
      description: "Dies ist meine Beschreibung zur Einzelauswahl", // German translation
      options: ["Option 1", "Option 2"], // Translated options
    },
    multiSelectQuestion: {
      question: "Dies ist meine Mehrfachauswahlfrage", // German translation
      description: "Dies ist die Beschreibung zur Mehrfachauswahl", // German translation
      options: ["Option 1", "Option 2", "Option 3"], // Translated options
    },
    ratingQuestion: {
      question: "Dies ist meine Bewertungsfrage", // German translation
      description: "Dies ist die Beschreibung zur Bewertung", // German translation
      lowLabel: "Mein unteres Label", // German translation
      highLabel: "Mein oberes Label", // German translation
    },
    npsQuestion: {
      question: "Dies ist meine NPS-Frage", // German translation
      lowLabel: "Mein unteres Label", // German translation
      highLabel: "Mein oberes Label", // German translation
    },
    ctaQuestion: {
      question: "Dies ist meine CTA-Frage", // German translation
      buttonLabel: "Mein Knopfetikett", // German translation
    },
    consentQuestion: {
      question: "Dies ist meine Zustimmungsfrage", // German translation
      checkboxLabel: "Mein Kontrollkästchen-Label", // German translation
    },
    pictureSelectQuestion: {
      question: "Dies ist meine Bildauswahlfrage", // German translation
      description: "Dies ist die Beschreibung zur Bildauswahl", // German translation
    },
    fileUploadQuestion: {
      question: "Dies ist meine Datei-Upload-Frage", // German translation
    },
    dateQuestion: {
      question: "Dies ist date question", // German translation
    },
    calQuestion: {
      question: "Dies ist cal question", // German translation
    },
    matrix: {
      question: "Wie hoch würden Sie diese Blumen bewerten?",
      description: "0: Überhaupt nicht, 3: Ich liebe es",
      rows: ["Rose", "Sunflower", "Hibiscus"],
      columns: ["0", "1", "2", "3"],
    },
    addressQuestion: {
      question: "Wo wohnst du ?",
      placeholder: {
        addressLine1: "Adresse",
        addressLine2: "Adresse",
        city: "Adresse",
        state: "Adresse",
        zip: "Adresse",
        country: "Adresse",
      },
    },
    ranking: {
      question: "Was ist für Sie im Leben am wichtigsten?",
      choices: ["Arbeit", "Geld", "Reisen", "Familie", "Freunde"],
    },
    thankYouCard: {
      headline: "Dies ist meine Dankeskarte Überschrift!", // German translation
      description: "Dies ist meine Beschreibung zur Dankeskarte!", // German translation
      buttonLabel: "Erstellen Sie Ihre eigene Umfrage",
    },
  },
};

export type CreateSurveyParams = typeof surveys.createAndSubmit;
export type CreateSurveyWithLogicParams = typeof surveys.createWithLogicAndSubmit;

export const actions = {
  create: {
    noCode: {
      click: {
        name: "Create Click Action (CSS Selector)",
        description: "This is my Create Action (click, CSS Selector)",
        selector: ".my-custom-class",
      },
      pageView: {
        name: "Create Page view Action (specific Page URL)",
        description: "This is my Create Action (Page view)",
        matcher: {
          label: "Contains",
          value: "custom-url",
        },
      },
      exitIntent: {
        name: "Create Exit Intent Action",
        description: "This is my Create Action (Exit Intent)",
      },
      fiftyPercentScroll: {
        name: "Create 50% Scroll Action",
        description: "This is my Create Action (50% Scroll)",
      },
    },
    code: {
      name: "Create Action (Code)",
      description: "This is my Create Action (Code)",
      key: "Create Action (Code)",
    },
  },
  edit: {
    noCode: {
      click: {
        name: "Edit Click Action (CSS Selector)",
        description: "This is my Edit Action (click, CSS Selector)",
        selector: ".my-custom-class-edited",
      },
      pageView: {
        name: "Edit Page view Action (specific Page URL)",
        description: "This is my Edit Action (Page view)",
        matcher: {
          label: "Starts with",
          value: "custom-url0-edited",
        },
        testURL: "http://localhost:3000/custom-url",
      },
      exitIntent: {
        name: "Edit Exit Intent Action",
        description: "This is my Edit Action (Exit Intent)",
      },
      fiftyPercentScroll: {
        name: "Edit 50% Scroll Action",
        description: "This is my Edit Action (50% Scroll)",
      },
    },
    code: {
      description: "This is my Edit Action (Code)",
    },
  },
  delete: {
    noCode: {
      name: "Delete click Action (CSS Selector)",
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
    name: "Organization User 2",
    email: "organization2@formbricks.com",
  },
};
