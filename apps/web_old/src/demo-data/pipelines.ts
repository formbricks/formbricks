export const getData = () => [
  {
    id: "demo-pipeline-email",
    createdAt: "2023-02-08T10:52:47.877Z",
    updatedAt: "2023-02-08T10:52:47.877Z",
    label: "Email Notification",
    type: "emailNotification",
    events: ["submissionFinished"],
    formId: "demo-pmf",
    enabled: true,
    config: {
      email: "mail@example.com",
    },
  },
  {
    id: "demo-pipeline-slack",
    createdAt: "2023-02-08T10:52:47.877Z",
    updatedAt: "2023-02-08T10:52:47.877Z",
    label: "Slack Team Notification",
    type: "slackNotification",
    events: ["submissionFinished"],
    formId: "demo-pmf",
    enabled: true,
    config: {
      endpointUrl: "https://hooks.slack.com/services/ABCDE01234/PQRST56789",
    },
  },
  {
    id: "demo-pipeline-webhook",
    createdAt: "2023-02-08T10:52:47.877Z",
    updatedAt: "2023-02-08T10:52:47.877Z",
    label: "Custom Webhook Integration",
    type: "webhook",
    events: ["submissionFinished"],
    formId: "demo-pmf",
    enabled: true,
    config: {
      endpointUrl: "https://api.example.com",
      secret: "MY_SECRET",
    },
  },
];
