import { type Survey, SurveyStatus, SurveyType } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";
// eslint-disable-next-line import/no-relative-packages -- Need to import from parent package
import { ZSurveyEnding, ZSurveyQuestion, ZSurveyVariable } from "../../types/surveys/types";

extendZodWithOpenApi(z);

const ZColor = z.string().regex(/^#(?:[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);

export const ZStylingColor = z.object({
  light: ZColor,
  dark: ZColor.nullish(),
});

export const ZCardArrangementOptions = z.enum(["casual", "straight", "simple"]);

export const ZCardArrangement = z.object({
  linkSurveys: ZCardArrangementOptions,
  appSurveys: ZCardArrangementOptions,
});

export const ZSurveyStylingBackground = z.object({
  bg: z.string().nullish(),
  bgType: z.enum(["animation", "color", "image", "upload"]).nullish(),
  brightness: z.number().nullish(),
});

export const ZPlacement = z.enum(["bottomLeft", "bottomRight", "topLeft", "topRight", "center"]);

const ZSurveyBase = z.object({
  id: z.string().cuid2().openapi({
    description: "The ID of the survey",
  }),
  createdAt: z.coerce.date().openapi({
    description: "The date and time the survey was created",
    example: "2021-01-01T00:00:00.000Z",
  }),
  updatedAt: z.coerce.date().openapi({
    description: "The date and time the survey was last updated",
    example: "2021-01-01T00:00:00.000Z",
  }),
  name: z.string().openapi({
    description: "The name of the survey",
  }),
  redirectUrl: z.string().url().nullable().openapi({
    description: "The URL to redirect to after the survey is completed",
  }),
  type: z.nativeEnum(SurveyType).openapi({
    description: "The type of the survey",
  }),
  status: z.nativeEnum(SurveyStatus).openapi({
    description: "The status of the survey",
  }),
  thankYouMessage: z.string().nullable().openapi({
    description: "The thank you message of the survey",
  }),
  showLanguageSwitch: z.boolean().nullable().openapi({
    description: "Whether to show the language switch",
  }),
  showThankYouMessage: z.boolean().nullable().openapi({
    description: "Whether to show the thank you message",
  }),
  welcomeCard: z
    .object({
      enabled: z.boolean(),
      timeToFinish: z.boolean(),
      showResponseCount: z.boolean(),
      headline: z.record(z.string()).optional(),
      html: z.record(z.string()).optional(),
      fileUrl: z.string().optional(),
      buttonLabel: z.record(z.string()).optional(),
      videoUrl: z.string().optional(),
    })
    .openapi({
      description: "The welcome card configuration",
    }),
  displayProgressBar: z.boolean().nullable().openapi({
    description: "Whether to display the progress bar",
  }),
  resultShareKey: z.string().nullable().openapi({
    description: "The result share key of the survey",
  }),
  pin: z.string().nullable().openapi({
    description: "The pin of the survey",
  }),
  createdBy: z.string().nullable().openapi({
    description: "The user who created the survey",
  }),
  environmentId: z.string().cuid2().openapi({
    description: "The environment ID of the survey",
  }),
  questions: z.array(ZSurveyQuestion).openapi({
    description: "The questions of the survey",
  }) as z.ZodType<Survey["questions"]>,
  endings: z.array(ZSurveyEnding).default([]).openapi({
    description: "The endings of the survey",
  }) as z.ZodType<Survey["endings"]>,
  thankYouCard: z
    .object({
      enabled: z.boolean(),
      message: z.string(),
    })
    .nullable()
    .openapi({
      description: "The thank you card of the survey (deprecated)",
    }),
  hiddenFields: z
    .object({
      enabled: z.boolean(),
      fieldIds: z.array(z.string()).optional(),
    })
    .openapi({
      description: "Hidden fields configuration",
    }),
  variables: z.array(ZSurveyVariable).openapi({
    description: "Survey variables",
  }) as z.ZodType<Survey["variables"]>,
  displayOption: z.enum(["displayOnce", "displayMultiple", "displaySome", "respondMultiple"]).openapi({
    description: "Display options for the survey",
  }),
  recontactDays: z.number().nullable().openapi({
    description: "Days before recontacting",
  }),
  displayLimit: z.number().nullable().openapi({
    description: "Display limit for the survey",
  }),
  autoClose: z.number().nullable().openapi({
    description: "Auto close time in seconds",
  }),
  autoComplete: z.number().nullable().openapi({
    description: "Auto complete time in seconds",
  }),
  delay: z.number().openapi({
    description: "Delay before showing survey",
  }),
  runOnDate: z.date().nullable().openapi({
    description: "Date to run the survey",
  }),
  closeOnDate: z.date().nullable().openapi({
    description: "Date to close the survey",
  }),
  surveyClosedMessage: z
    .object({
      enabled: z.boolean(),
      heading: z.string(),
      subheading: z.string(),
    })
    .nullable()
    .openapi({
      description: "Message shown when survey is closed",
    }),
  segmentId: z.string().nullable().openapi({
    description: "ID of the segment",
  }),
  projectOverwrites: z
    .object({
      brandColor: ZColor.nullish(),
      highlightBorderColor: ZColor.nullish(),
      placement: ZPlacement.nullish(),
      clickOutsideClose: z.boolean().nullish(),
      darkOverlay: z.boolean().nullish(),
    })
    .nullable()
    .openapi({
      description: "Project specific overwrites",
    }),
  styling: z
    .object({
      brandColor: ZStylingColor.nullish(),
      questionColor: ZStylingColor.nullish(),
      inputColor: ZStylingColor.nullish(),
      inputBorderColor: ZStylingColor.nullish(),
      cardBackgroundColor: ZStylingColor.nullish(),
      cardBorderColor: ZStylingColor.nullish(),
      cardShadowColor: ZStylingColor.nullish(),
      highlightBorderColor: ZStylingColor.nullish(),
      isDarkModeEnabled: z.boolean().nullish(),
      roundness: z.number().nullish(),
      cardArrangement: ZCardArrangement.nullish(),
      background: ZSurveyStylingBackground.nullish(),
      hideProgressBar: z.boolean().nullish(),
      isLogoHidden: z.boolean().nullish(),
    })
    .nullable()
    .openapi({
      description: "Survey styling configuration",
    }),
  singleUse: z
    .object({
      enabled: z.boolean(),
      isEncrypted: z.boolean(),
    })
    .openapi({
      description: "Single use configuration",
    }),
  isVerifyEmailEnabled: z.boolean().openapi({
    description: "Whether email verification is enabled",
  }),
  isSingleResponsePerEmailEnabled: z.boolean().openapi({
    description: "Whether single response per email is enabled",
  }),
  inlineTriggers: z.array(z.any()).nullable().openapi({
    description: "Inline triggers configuration",
  }),
  isBackButtonHidden: z.boolean().openapi({
    description: "Whether the back button is hidden",
  }),
  verifyEmail: z
    .object({
      enabled: z.boolean(),
      message: z.string(),
    })
    .openapi({
      description: "Email verification configuration (deprecated)",
    }),
  displayPercentage: z.number().nullable().openapi({
    description: "The display percentage of the survey",
  }) as z.ZodType<Survey["displayPercentage"]>,
});

export const ZSurvey = ZSurveyBase satisfies z.ZodType<Survey>;

export const ZSurveyWithoutQuestionType = ZSurveyBase.omit({
  questions: true,
}).extend({
  questions: z.array(z.any()).openapi({
    description:
      "The questions of the survey. It's a list of question objects. We don't provide the type here due to the complexity of the question types.",
  }),
});

ZSurvey.openapi({
  ref: "survey",
  description: "A survey",
});
