"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError, UnknownError } from "@formbricks/types/errors";
import { TResponseInput } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { getEmailTemplateHtml } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate";
import { createResponseWithQuotaEvaluation } from "@/app/api/v1/client/[environmentId]/responses/lib/response";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getSurvey, updateSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { convertToCsv } from "@/lib/utils/file-conversion";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { generatePersonalLinks } from "@/modules/ee/contacts/lib/contacts";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendEmbedSurveyPreviewEmail } from "@/modules/email";
import { deleteResponsesAndDisplaysForSurvey } from "./lib/survey";

const loremIpsumSentences = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit.",
  "Nisi ut aliquip ex ea commodo consequat.",
  "Pellentesque habitant morbi tristique senectus et netus et malesuada fames.",
  "Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante.",
  "Donec eu libero sit amet quam egestas semper.",
  "Aenean ultricies mi vitae est. Mauris placerat eleifend leo.",
];

function generateLoremIpsum(): string {
  const sentenceCount = Math.floor(Math.random() * 3) + 1;
  const selectedSentences: string[] = [];
  for (let i = 0; i < sentenceCount; i++) {
    const randomIndex = Math.floor(Math.random() * loremIpsumSentences.length);
    selectedSentences.push(loremIpsumSentences[randomIndex]);
  }
  return selectedSentences.join(" ");
}

const ZSendEmbedSurveyPreviewEmailAction = z.object({
  surveyId: ZId,
});

export const sendEmbedSurveyPreviewEmailAction = authenticatedActionClient
  .schema(ZSendEmbedSurveyPreviewEmailAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
    const organizationLogoUrl = await getOrganizationLogoUrl(organizationId);

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
          minPermission: "read",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    const rawEmailHtml = await getEmailTemplateHtml(parsedInput.surveyId, ctx.user.locale);
    const emailHtml = rawEmailHtml
      .replaceAll("?preview=true&amp;", "?")
      .replaceAll("?preview=true&;", "?")
      .replaceAll("?preview=true", "");

    return await sendEmbedSurveyPreviewEmail(
      ctx.user.email,
      emailHtml,
      survey.environmentId,
      organizationLogoUrl || ""
    );
  });

const ZResetSurveyAction = z.object({
  surveyId: ZId,
  organizationId: ZId,
  projectId: ZId,
});

export const resetSurveyAction = authenticatedActionClient.schema(ZResetSurveyAction).action(
  withAuditLogging(
    "updated",
    "survey",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZResetSurveyAction>;
    }) => {
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: parsedInput.projectId,
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
      ctx.auditLoggingCtx.oldObject = null;

      const { deletedResponsesCount, deletedDisplaysCount } = await deleteResponsesAndDisplaysForSurvey(
        parsedInput.surveyId
      );

      ctx.auditLoggingCtx.newObject = {
        deletedResponsesCount: deletedResponsesCount,
        deletedDisplaysCount: deletedDisplaysCount,
      };

      return {
        success: true,
        deletedResponsesCount: deletedResponsesCount,
        deletedDisplaysCount: deletedDisplaysCount,
      };
    }
  )
);

const ZGetEmailHtmlAction = z.object({
  surveyId: ZId,
});

export const getEmailHtmlAction = authenticatedActionClient
  .schema(ZGetEmailHtmlAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "readWrite",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return await getEmailTemplateHtml(parsedInput.surveyId, ctx.user.locale);
  });

const ZGeneratePersonalLinksAction = z.object({
  surveyId: ZId,
  segmentId: ZId,
  environmentId: ZId,
  expirationDays: z.number().optional(),
});

export const generatePersonalLinksAction = authenticatedActionClient
  .schema(ZGeneratePersonalLinksAction)
  .action(async ({ ctx, parsedInput }) => {
    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      throw new OperationNotAllowedError("Contacts are not enabled for this environment");
    }

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    // Get contacts and generate personal links
    const contactsResult = await generatePersonalLinks(
      parsedInput.surveyId,
      parsedInput.segmentId,
      parsedInput.expirationDays
    );

    if (!contactsResult || contactsResult.length === 0) {
      throw new UnknownError("No contacts found for the selected segment");
    }

    // Prepare CSV data with the specified headers and order
    const csvHeaders = [
      "Formbricks Contact ID",
      "User ID",
      "First Name",
      "Last Name",
      "Email",
      "Personal Link",
    ];

    const csvData = contactsResult
      .map((contact) => {
        if (!contact) {
          return null;
        }
        const attributes = contact.attributes ?? {};
        return {
          "Formbricks Contact ID": contact.contactId,
          "User ID": attributes.userId ?? "",
          "First Name": attributes.firstName ?? "",
          "Last Name": attributes.lastName ?? "",
          Email: attributes.email ?? "",
          "Personal Link": contact.surveyUrl,
        };
      })
      .filter((contact) => contact !== null);

    // Convert to CSV using the file conversion utility
    const csvContent = await convertToCsv(csvHeaders, csvData);
    const fileName = `personal-links-${parsedInput.surveyId}-${Date.now()}.csv`;

    return {
      fileName,
      csvContent,
    };
  });

const ZUpdateSingleUseLinksAction = z.object({
  surveyId: ZId,
  environmentId: ZId,
  isSingleUse: z.boolean(),
  isSingleUseEncryption: z.boolean(),
});

export const updateSingleUseLinksAction = authenticatedActionClient
  .schema(ZUpdateSingleUseLinksAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    const updatedSurvey = await updateSurvey({
      ...survey,
      singleUse: { enabled: parsedInput.isSingleUse, isEncrypted: parsedInput.isSingleUseEncryption },
    });

    return updatedSurvey;
  });

const ZGenerateTestResponsesAction = z.object({
  surveyId: ZId,
  environmentId: ZId,
});

export const generateTestResponsesAction = authenticatedActionClient
  .schema(ZGenerateTestResponsesAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
          minPermission: "readWrite",
        },
      ],
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    if (survey.environmentId !== parsedInput.environmentId) {
      throw new OperationNotAllowedError("Survey does not belong to the specified environment");
    }

    const supportedElementTypes = [
      TSurveyElementTypeEnum.OpenText,
      TSurveyElementTypeEnum.NPS,
      TSurveyElementTypeEnum.Rating,
      TSurveyElementTypeEnum.MultipleChoiceSingle,
      TSurveyElementTypeEnum.MultipleChoiceMulti,
      TSurveyElementTypeEnum.PictureSelection,
      TSurveyElementTypeEnum.Ranking,
      TSurveyElementTypeEnum.Matrix,
    ];

    // Extract elements from blocks
    const elements = getElementsFromBlocks(survey.blocks);
    const supportedElements = elements.filter((element) => supportedElementTypes.includes(element.type));

    if (supportedElements.length === 0) {
      throw new OperationNotAllowedError(
        "Survey does not contain any supported question types (OpenText, NPS, Rating, Multiple Choice, Picture Selection, Ranking, or Matrix)"
      );
    }

    const responsesToCreate = 5;
    const createdResponses: string[] = [];

    for (let i = 0; i < responsesToCreate; i++) {
      const responseData: Record<string, string | number | string[] | Record<string, string>> = {};

      for (const element of supportedElements) {
        if (element.type === TSurveyElementTypeEnum.OpenText) {
          responseData[element.id] = generateLoremIpsum();
        } else if (element.type === TSurveyElementTypeEnum.NPS) {
          responseData[element.id] = Math.floor(Math.random() * 11);
        } else if (element.type === TSurveyElementTypeEnum.Rating) {
          const range = "range" in element && typeof element.range === "number" ? element.range : 5;
          responseData[element.id] = Math.floor(Math.random() * range) + 1;
        } else if (element.type === TSurveyElementTypeEnum.MultipleChoiceSingle) {
          // Single choice: pick one random option, store the label
          if ("choices" in element && Array.isArray(element.choices) && element.choices.length > 0) {
            const randomIndex = Math.floor(Math.random() * element.choices.length);
            const selectedChoice = element.choices[randomIndex];
            // For "other" option, generate custom text; otherwise use the choice label
            responseData[element.id] =
              selectedChoice.id === "other"
                ? generateLoremIpsum()
                : getLocalizedValue(selectedChoice.label, "default");
          }
        } else if (element.type === TSurveyElementTypeEnum.MultipleChoiceMulti) {
          // Multi choice: pick 1-3 random options, store the labels
          if ("choices" in element && Array.isArray(element.choices) && element.choices.length > 0) {
            const numSelections = Math.min(Math.floor(Math.random() * 3) + 1, element.choices.length);
            const shuffled = [...element.choices].sort(() => Math.random() - 0.5);
            responseData[element.id] = shuffled.slice(0, numSelections).map((choice) => {
              // For "other" option, generate custom text; otherwise use the choice label
              return choice.id === "other"
                ? generateLoremIpsum()
                : getLocalizedValue(choice.label, "default");
            });
          }
        } else if (element.type === TSurveyElementTypeEnum.PictureSelection) {
          // Picture selection: single or multi based on allowMulti
          if ("choices" in element && Array.isArray(element.choices) && element.choices.length > 0) {
            const allowMulti = "allowMulti" in element ? element.allowMulti : false;
            if (allowMulti) {
              const numSelections = Math.min(Math.floor(Math.random() * 3) + 1, element.choices.length);
              const shuffled = [...element.choices].sort(() => Math.random() - 0.5);
              responseData[element.id] = shuffled.slice(0, numSelections).map((choice) => choice.id);
            } else {
              const randomIndex = Math.floor(Math.random() * element.choices.length);
              responseData[element.id] = element.choices[randomIndex].id;
            }
          }
        } else if (element.type === TSurveyElementTypeEnum.Ranking) {
          // Ranking: all options in random order, store the labels
          if ("choices" in element && Array.isArray(element.choices) && element.choices.length > 0) {
            const shuffled = [...element.choices].sort(() => Math.random() - 0.5);
            responseData[element.id] = shuffled.map((choice) => {
              // For "other" option, generate custom text; otherwise use the choice label
              return choice.id === "other"
                ? generateLoremIpsum()
                : getLocalizedValue(choice.label, "default");
            });
          }
        } else if (element.type === TSurveyElementTypeEnum.Matrix) {
          // Matrix: for each row, pick a random column
          if (
            "rows" in element &&
            "columns" in element &&
            Array.isArray(element.rows) &&
            Array.isArray(element.columns) &&
            element.rows.length > 0 &&
            element.columns.length > 0
          ) {
            const matrixData: Record<string, string> = {};
            for (const row of element.rows) {
              const randomColumnIndex = Math.floor(Math.random() * element.columns.length);
              matrixData[row.id] = element.columns[randomColumnIndex].id;
            }
            responseData[element.id] = matrixData;
          }
        }
      }

      const responseInput: TResponseInput = {
        environmentId: parsedInput.environmentId,
        surveyId: parsedInput.surveyId,
        finished: true,
        data: responseData,
        meta: {
          source: "test",
          userAgent: {
            browser: "Test Generator",
            device: "desktop",
            os: "Test OS",
          },
        },
      };

      try {
        const response = await createResponseWithQuotaEvaluation(responseInput);
        createdResponses.push(response.id);
      } catch (error) {
        throw new UnknownError(
          `Failed to create response: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    return {
      success: true,
      createdCount: createdResponses.length,
    };
  });
