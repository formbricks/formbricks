import { z } from "zod";
import { ZEndingCardUrl, ZId, ZStorageUrl } from "@formbricks/types/common";
import { ZI18nString } from "@formbricks/types/i18n";
import { ZSurveyBlocks } from "@formbricks/types/surveys/blocks";
import { ZSurveyCreateInput, ZSurveyStatus, ZSurveyType } from "@formbricks/types/surveys/types";
import { FORBIDDEN_IDS } from "@formbricks/types/surveys/validation";
import { normalizeV3SurveyCreateInput } from "./adapters";

const ZV3SurveyEndScreen = z.strictObject({
  id: z.cuid2(),
  type: z.literal("endScreen"),
  headline: ZI18nString.optional(),
  subheader: ZI18nString.optional(),
  buttonLabel: ZI18nString.optional(),
  buttonLink: ZEndingCardUrl.optional(),
  imageUrl: ZStorageUrl.optional(),
  videoUrl: ZStorageUrl.optional(),
});

const ZV3SurveyRedirectEnding = z.strictObject({
  id: z.cuid2(),
  type: z.literal("redirectToUrl"),
  url: ZEndingCardUrl.optional(),
  label: z.string().optional(),
});

const ZV3SurveyEndings = z.array(z.union([ZV3SurveyEndScreen, ZV3SurveyRedirectEnding]));

const ZV3SurveyWelcomeCard = z
  .strictObject({
    enabled: z.boolean(),
    headline: ZI18nString.optional(),
    subheader: ZI18nString.optional(),
    fileUrl: ZStorageUrl.optional(),
    buttonLabel: ZI18nString.optional(),
    timeToFinish: z.boolean().prefault(true),
    showResponseCount: z.boolean().prefault(false),
    videoUrl: ZStorageUrl.optional(),
  })
  .refine((value) => !(value.enabled && !value.headline), {
    error: "Welcome card must have a headline",
  });

const ZV3HiddenFieldId = z.string().superRefine((field, ctx) => {
  if (FORBIDDEN_IDS.includes(field)) {
    ctx.addIssue({
      code: "custom",
      message: "Hidden field id is not allowed",
    });
  }

  if (field.includes(" ")) {
    ctx.addIssue({
      code: "custom",
      message: "Hidden field id not allowed, avoid using spaces.",
    });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(field)) {
    ctx.addIssue({
      code: "custom",
      message: "Hidden field id not allowed, use only alphanumeric characters, hyphens, or underscores.",
    });
  }
});

const ZV3SurveyHiddenFields = z.strictObject({
  enabled: z.boolean(),
  fieldIds: z.array(ZV3HiddenFieldId).optional(),
});

const ZV3SurveyVariable = z
  .discriminatedUnion("type", [
    z.strictObject({
      id: z.cuid2(),
      name: z.string(),
      type: z.literal("number"),
      value: z.number().prefault(0),
    }),
    z.strictObject({
      id: z.cuid2(),
      name: z.string(),
      type: z.literal("text"),
      value: z.string().prefault(""),
    }),
  ])
  .superRefine((value, ctx) => {
    if (!/^[a-z0-9_]+$/.test(value.name)) {
      ctx.addIssue({
        code: "custom",
        message: "Variable name can only contain lowercase letters, numbers, and underscores",
        path: ["name"],
      });
    }
  });

const ZV3SurveyVariables = z.array(ZV3SurveyVariable);

function addCreateInputIssues(body: TV3SurveyCreateBody, ctx: z.RefinementCtx): void {
  const result = ZSurveyCreateInput.safeParse(normalizeV3SurveyCreateInput(body, null));
  if (result.success) {
    return;
  }

  for (const issue of result.error.issues) {
    ctx.addIssue(issue as any);
  }
}

export const ZV3SurveyCreateBody = z
  .strictObject({
    workspaceId: ZId,
    name: z.string().trim().min(1),
    type: ZSurveyType.default("link"),
    status: ZSurveyStatus.default("draft"),
    welcomeCard: ZV3SurveyWelcomeCard.prefault({
      enabled: false,
    }),
    blocks: ZSurveyBlocks.min(1, {
      error: "Survey must have at least one block",
    }),
    endings: ZV3SurveyEndings.default([]),
    hiddenFields: ZV3SurveyHiddenFields.prefault({
      enabled: false,
    }),
    variables: ZV3SurveyVariables.default([]),
  })
  .superRefine(addCreateInputIssues);

export const ZV3SurveyPatchBody = z
  .strictObject({
    name: z.string().trim().min(1).optional(),
    type: ZSurveyType.optional(),
    status: ZSurveyStatus.optional(),
    welcomeCard: ZV3SurveyWelcomeCard.optional(),
    blocks: ZSurveyBlocks.optional(),
    endings: ZV3SurveyEndings.optional(),
    hiddenFields: ZV3SurveyHiddenFields.optional(),
    variables: ZV3SurveyVariables.optional(),
  })
  .superRefine((body, ctx) => {
    if (Object.keys(body).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Request body must include at least one updatable field",
        path: [],
      });
    }
  });

export const ZV3SurveyRouteParams = z.strictObject({
  surveyId: ZId,
});

export type TV3SurveyCreateBody = z.infer<typeof ZV3SurveyCreateBody>;
export type TV3SurveyPatchBody = z.infer<typeof ZV3SurveyPatchBody>;
export type TV3SurveyRouteParams = z.infer<typeof ZV3SurveyRouteParams>;
