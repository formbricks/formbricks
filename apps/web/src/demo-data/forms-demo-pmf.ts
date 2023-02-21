export const getData = () => ({
  id: "demo-pmf",
  createdAt: "2023-02-03T12:22:03.346Z",
  updatedAt: "2023-02-03T12:22:03.346Z",
  type: "pmf",
  label: "Product Market Fit Demo",
  organisationId: "demo-organisation",
  schema: {
    pages: [
      {
        id: "disappointmentPage",
        config: {
          autoSubmit: true,
        },
        elements: [
          {
            id: "disappointment",
            name: "disappointment",
            type: "radio",
            label: "How disappointed would you be if you could no longer use our service?",
            options: [
              {
                label: "Very disappointed",
                value: "veryDisappointed",
              },
              {
                label: "Somewhat disappointed",
                value: "somewhatDisappointed",
              },
              {
                label: "Not disappointed",
                value: "notDisappointed",
              },
            ],
          },
        ],
      },
      {
        id: "mainBenefitPage",
        elements: [
          {
            id: "mainBenefit",
            name: "mainBenefit",
            type: "text",
            label: "What is the main benefit you receive from our service?",
          },
        ],
      },
      {
        id: "rolePage",
        config: {
          autoSubmit: true,
        },
        elements: [
          {
            id: "role",
            name: "role",
            type: "radio",
            label: "What is your job title?",
            options: [
              {
                label: "Founder",
                value: "founder",
              },
              {
                label: "Executive",
                value: "executive",
              },
              {
                label: "Product Manager",
                value: "productManager",
              },
              {
                label: "Product Owner",
                value: "productOwner",
              },
              {
                label: "Software Engineer",
                value: "softwareEngineer",
              },
            ],
          },
        ],
      },
      {
        id: "improvementPage",
        elements: [
          {
            id: "improvement",
            name: "improvement",
            type: "text",
            label: "How can we improve our service for you?",
          },
        ],
      },
      {
        id: "benefitingUsersPage",
        elements: [
          {
            id: "benefitingUsers",
            name: "benefitingUsers",
            type: "text",
            label: "What type of people would benefit most from using our service?",
          },
        ],
      },
      {
        id: "thankYouPage",
        elements: [
          {
            id: "thankYou",
            name: "thankYou",
            type: "html",
          },
        ],
        endScreen: true,
      },
    ],
    config: {},
    schemaVersion: 1,
  },
});
