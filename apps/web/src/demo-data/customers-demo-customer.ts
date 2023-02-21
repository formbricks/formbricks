export const getData = () => ({
  email: "user@example.com",
  createdAt: "2023-02-03T12:20:58.516Z",
  updatedAt: "2023-02-03T12:20:58.516Z",
  organisationId: "cldoc9md4000119204dn8i5td",
  data: {
    name: "John",
  },
  submissions: [
    {
      id: "cldoi02dh000619vitjyq89n0",
      createdAt: "2023-02-03T12:24:00.774Z",
      updatedAt: "2023-02-03T12:24:35.356Z",
      finished: true,
      archived: false,
      formId: "cldohxjrl000519viwe8i9d39",
      customerEmail: "test@crowd.dev",
      customerOrganisationId: "cldoc9md4000119204dn8i5td",
      data: {
        improvement: "Make it possible to add a note to a transaction",
        mainBenefit: "The best is that I can get a quick overview of all my transactions",
        role: "founder",
        disappointment: "veryDisappointed",
        benefitingUsers: "other founders",
      },
      meta: {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
      },
      form: {
        id: "cldohxjrl000519viwe8i9d39",
        createdAt: "2023-02-03T12:22:03.346Z",
        updatedAt: "2023-02-03T12:22:03.346Z",
        type: "pmf",
        label: "Product Market Fit Demo",
        organisationId: "cldoc9md4000119204dn8i5td",
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
      },
    },
    {
      id: "cldohw5qs000119vi6sv59odw",
      createdAt: "2023-02-03T12:20:58.516Z",
      updatedAt: "2023-02-03T12:20:58.516Z",
      finished: true,
      archived: false,
      formId: "cldohpx4t000019vijzlf8mgn",
      customerEmail: "user@example.com",
      customerOrganisationId: "cldoc9md4000119204dn8i5td",
      data: {
        message: "Really love your new design. Great job guys!",
        pageUrl: "http://localhost:3002/feedback-widget",
        feedbackType: "compliment",
      },
      meta: {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
      },
      form: {
        id: "cldohpx4t000019vijzlf8mgn",
        createdAt: "2023-02-03T12:16:07.422Z",
        updatedAt: "2023-02-03T12:16:07.422Z",
        type: "feedback",
        label: "Feedback Form Demo",
        organisationId: "cldoc9md4000119204dn8i5td",
        schema: {
          pages: [
            {
              id: "feedbackTypePage",
              elements: [
                {
                  name: "feedbackType",
                  type: "radio",
                  label: "What's on your mind?",
                  options: [
                    {
                      label: "Idea",
                      value: "idea",
                    },
                    {
                      label: "Compliment",
                      value: "compliment",
                    },
                    {
                      label: "Bug",
                      value: "bug",
                    },
                  ],
                },
              ],
            },
            {
              id: "messagePage",
              elements: [
                {
                  name: "message",
                  type: "textarea",
                  label: "What's your feedback?",
                },
              ],
            },
            {
              id: "thankYouPage",
              elements: [
                {
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
      },
    },
    {
      id: "cldohwtyr000319viwrymradt",
      createdAt: "2023-02-03T12:21:29.908Z",
      updatedAt: "2023-02-03T12:21:29.908Z",
      finished: true,
      archived: false,
      formId: "cldohpx4t000019vijzlf8mgn",
      customerEmail: "user@example.com",
      customerOrganisationId: "cldoc9md4000119204dn8i5td",
      data: {
        message: "Maybe you can add a mobile app so I can check my account balance on the go 😊",
        pageUrl: "http://localhost:3002/feedback-widget",
        feedbackType: "idea",
      },
      meta: {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
      },
      form: {
        id: "cldohpx4t000019vijzlf8mgn",
        createdAt: "2023-02-03T12:16:07.422Z",
        updatedAt: "2023-02-03T12:16:07.422Z",
        type: "feedback",
        label: "Feedback Form Demo",
        organisationId: "cldoc9md4000119204dn8i5td",
        schema: {
          pages: [
            {
              id: "feedbackTypePage",
              elements: [
                {
                  name: "feedbackType",
                  type: "radio",
                  label: "What's on your mind?",
                  options: [
                    {
                      label: "Idea",
                      value: "idea",
                    },
                    {
                      label: "Compliment",
                      value: "compliment",
                    },
                    {
                      label: "Bug",
                      value: "bug",
                    },
                  ],
                },
              ],
            },
            {
              id: "messagePage",
              elements: [
                {
                  name: "message",
                  type: "textarea",
                  label: "What's your feedback?",
                },
              ],
            },
            {
              id: "thankYouPage",
              elements: [
                {
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
      },
    },
    {
      id: "cldohx4lk000419vilwqzfcnk",
      createdAt: "2023-02-03T12:21:43.688Z",
      updatedAt: "2023-02-03T12:21:43.688Z",
      finished: true,
      archived: false,
      formId: "cldohpx4t000019vijzlf8mgn",
      customerEmail: "user@example.com",
      customerOrganisationId: "cldoc9md4000119204dn8i5td",
      data: {
        message: 'I get a blank page after clicking on "my profile"',
        pageUrl: "http://localhost:3002/feedback-widget",
        feedbackType: "bug",
      },
      meta: {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
      },
      form: {
        id: "cldohpx4t000019vijzlf8mgn",
        createdAt: "2023-02-03T12:16:07.422Z",
        updatedAt: "2023-02-03T12:16:07.422Z",
        type: "feedback",
        label: "Feedback Form Demo",
        organisationId: "cldoc9md4000119204dn8i5td",
        schema: {
          pages: [
            {
              id: "feedbackTypePage",
              elements: [
                {
                  name: "feedbackType",
                  type: "radio",
                  label: "What's on your mind?",
                  options: [
                    {
                      label: "Idea",
                      value: "idea",
                    },
                    {
                      label: "Compliment",
                      value: "compliment",
                    },
                    {
                      label: "Bug",
                      value: "bug",
                    },
                  ],
                },
              ],
            },
            {
              id: "messagePage",
              elements: [
                {
                  name: "message",
                  type: "textarea",
                  label: "What's your feedback?",
                },
              ],
            },
            {
              id: "thankYouPage",
              elements: [
                {
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
      },
    },
  ],
});
