"use server";

import { llmModel } from "@/lib/aiModels";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromEnvironmentId, getProjectIdFromEnvironmentId } from "@/lib/utils/helper";
import { getIsAIEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAIKeys } from "@/modules/survey/lib/organization";
import { createSurvey } from "@/modules/survey/templates/lib/survey";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { ZSurveyQuestion } from "@formbricks/types/surveys/types";

const ZCreateAISurveyAction = z.object({
  environmentId: z.string().cuid2(),
  prompt: z.string(),
});

export const createAISurveyAction = authenticatedActionClient
  .schema(ZCreateAISurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
          minPermission: "readWrite",
        },
      ],
    });

    const organization = await getOrganizationAIKeys(organizationId);

    if (!organization) {
      throw new Error("Organization not found");
    }

    const isAIEnabled = await getIsAIEnabled({
      isAIEnabled: organization.isAIEnabled,
      billing: organization.billing,
    });

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
