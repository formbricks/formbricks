// Mock data for email templates to use in React Email preview server
import { TOrganization } from "@formbricks/types/organizations";
import { TResponse } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";

export const exampleData = {
  verificationEmail: {
    verifyLink: "https://app.formbricks.com/auth/verify?token=example-verification-token",
    verificationRequestLink: "https://app.formbricks.com/auth/verification-requested",
  },

  forgotPasswordEmail: {
    verifyLink: "https://app.formbricks.com/auth/forgot-password/reset?token=example-reset-token",
  },

  newEmailVerification: {
    verifyLink: "https://app.formbricks.com/verify-email-change?token=example-email-change-token",
  },

  passwordResetNotifyEmail: {
    // No props needed
  },

  inviteEmail: {
    inviteeName: "Jane Smith",
    inviterName: "John Doe",
    verifyLink: "https://app.formbricks.com/invite?token=example-invite-token",
  },

  inviteAcceptedEmail: {
    inviterName: "John Doe",
    inviteeName: "Jane Smith",
  },

  linkSurveyEmail: {
    surveyName: "Customer Satisfaction Survey",
    surveyLink:
      "https://app.formbricks.com/s/example-survey-id?verify=example-token&suId=example-single-use-id",
  },

  embedSurveyPreviewEmail: {
    html: '<div style="padding: 20px; background-color: #f3f4f6; border-radius: 8px;"><h3 style="margin-top: 0;">Example Survey Embed</h3><p>This is a preview of how your survey will look when embedded in an email.</p></div>',
    environmentId: "clxyz123456789",
  },

  responseFinishedEmail: {
    survey: {
      id: "survey-123",
      name: "Customer Feedback Survey",
      variables: [
        {
          id: "var-1",
          name: "Customer ID",
          type: "text" as const,
        },
      ],
      hiddenFields: {
        enabled: true,
        fieldIds: ["userId"],
      },
      welcomeCard: {
        enabled: false,
      },
      questions: [
        {
          id: "q1",
          type: "openText" as const,
          headline: { default: "What did you like most?" },
          required: true,
          inputType: "text" as const,
        },
        {
          id: "q2",
          type: "rating" as const,
          headline: { default: "How would you rate your experience?" },
          required: true,
          scale: "number" as const,
          range: 5,
        },
      ],
      endings: [],
      styling: {},
      createdBy: null,
    } as unknown as TSurvey,
    responseCount: 15,
    response: {
      id: "response-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      surveyId: "survey-123",
      finished: true,
      data: {
        q1: "The customer service was excellent!",
        q2: 5,
        userId: "user-abc-123",
      },
      variables: {
        "var-1": "CUST-456",
      },
      contactAttributes: {
        email: "customer@example.com",
      },
      meta: {
        userAgent: {},
        url: "https://example.com",
      },
      tags: [],
      ttc: {},
      singleUseId: null,
      language: "default",
      displayId: null,
    } as unknown as TResponse,
    WEBAPP_URL: "https://app.formbricks.com",
    environmentId: "env-123",
    organization: {
      id: "org-123",
      name: "Acme Corporation",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        subscriptionStatus: null,
        features: {
          inAppSurvey: { status: "active" as const, unlimited: true },
          linkSurvey: { status: "active" as const, unlimited: true },
          userTargeting: { status: "active" as const, unlimited: true },
        },
        limits: {
          monthly: {
            responses: 1000,
            miu: 10000,
          },
        },
      },
      isAIEnabled: false,
    } as unknown as TOrganization,
  },

  followUpEmail: {
    body: "<p>Thank you for your feedback! We've received your response and will review it shortly.</p><p>Here's a summary of what you submitted:</p>",
    responseData: [
      {
        element: "What did you like most?",
        response: "The customer service was excellent!",
        type: TSurveyElementTypeEnum.OpenText,
      },
      {
        element: "How would you rate your experience?",
        response: "5",
        type: TSurveyElementTypeEnum.Rating,
      },
    ],
    variables: [
      {
        id: "var-1",
        name: "Customer ID",
        type: "text",
        value: "CUST-456",
      },
    ],
    hiddenFields: [
      {
        id: "userId",
        value: "user-abc-123",
      },
    ],
  },

  emailCustomizationPreviewEmail: {
    userName: "Alex Johnson",
  },

  legalProps: {
    privacyUrl: "https://formbricks.com/privacy",
    termsUrl: "https://formbricks.com/terms",
    imprintUrl: "https://formbricks.com/imprint",
    imprintAddress: "Formbricks GmbH, Example Street 123, 12345 Berlin, Germany",
  },
};

export type ExampleDataKeys = keyof typeof exampleData;
export type ExampleData<K extends ExampleDataKeys> = (typeof exampleData)[K];
