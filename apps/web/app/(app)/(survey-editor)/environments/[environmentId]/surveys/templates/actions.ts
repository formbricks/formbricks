"use server";

import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { llmModel } from "@formbricks/lib/aiModels";
import { getOrganization } from "@formbricks/lib/organization/service";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { createSurvey } from "@formbricks/lib/survey/service";
import { getIsAIEnabled } from "@formbricks/lib/utils/ai";
import { ZId, ZString } from "@formbricks/types/common";
import { ZSurveyQuestion } from "@formbricks/types/surveys/types";

const ZCreateAISurveyAction = z.object({
  environmentId: ZId,
  prompt: ZString,
});

export const createAISurveyAction = authenticatedActionClient
  .schema(ZCreateAISurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId,
      rules: ["survey", "create"],
    });

    const organization = await getOrganization(organizationId);

    if (!organization) {
      throw new Error("Organization not found");
    }

    const isAIEnabled = await getIsAIEnabled(organization);

    if (!isAIEnabled) {
      throw new Error("AI is not enabled for this organization");
    }

    const { object } = await generateObject({
      model: llmModel,
      schema: z.object({
        name: z.string(),
        questions: z.array(
          z.object({
            headline: z.string(),
            subheader: z.string(),
            type: z.enum(["openText", "multipleChoiceSingle", "multipleChoiceMulti"]),
            choices: z
              .array(z.string())
              .min(2, { message: "Multiple Choice Question must have at least two choices" })
              .optional(),
          })
        ),
      }),
      system: `You are a survey AI. Create a survey with 3 questions max that fits the schema and user input.`,
      prompt: parsedInput.prompt,
      experimental_telemetry: { isEnabled: true },
    });

    const parsedQuestions = object.questions.map((question) => {
      return ZSurveyQuestion.parse({
        id: createId(),
        headline: { default: question.headline },
        subheader: { default: question.subheader },
        type: question.type,
        choices: question.choices
          ? question.choices.map((choice) => ({ id: createId(), label: { default: choice } }))
          : undefined,
        required: true,
      });
    });

    return await createSurvey(parsedInput.environmentId, { name: object.name, questions: parsedQuestions });
  });
