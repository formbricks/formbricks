"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { ZContactAttributes } from "@formbricks/types/contact-attribute";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromContactId, getProjectIdFromContactId } from "@/lib/utils/helper";
import { updateAttributes } from "@/modules/ee/contacts/lib/attributes";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";

const ZUpdateContactAttributeAction = z.object({
  contactId: ZId,
  attributes: ZContactAttributes,
});

export const updateContactAttributeAction = authenticatedActionClient
  .schema(ZUpdateContactAttributeAction)
  .action(async ({ ctx, parsedInput }) => {
    const contact = await prisma.contact.findUnique({
      where: { id: parsedInput.contactId },
      select: { environmentId: true },
    });

    if (!contact) {
      throw new ResourceNotFoundError("Contact", parsedInput.contactId);
    }

    const organizationId = await getOrganizationIdFromContactId(parsedInput.contactId);
    const projectId = await getProjectIdFromContactId(parsedInput.contactId);

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
          minPermission: "readWrite",
          projectId,
        },
      ],
    });

    const result = await updateAttributes(
      parsedInput.contactId,
      ctx.user.id,
      contact.environmentId,
      parsedInput.attributes
    );

    return result;
  });

const ZDeleteContactAttributeAction = z.object({
  contactId: ZId,
  attributeKey: z.string(),
});

export const deleteContactAttributeAction = authenticatedActionClient
  .schema(ZDeleteContactAttributeAction)
  .action(async ({ ctx, parsedInput }) => {
    const contact = await prisma.contact.findUnique({
      where: { id: parsedInput.contactId },
      select: { environmentId: true },
    });

    if (!contact) {
      throw new ResourceNotFoundError("Contact", parsedInput.contactId);
    }

    const organizationId = await getOrganizationIdFromContactId(parsedInput.contactId);
    const projectId = await getProjectIdFromContactId(parsedInput.contactId);

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
          minPermission: "readWrite",
          projectId,
        },
      ],
    });

    // Find the attribute key
    const attributeKey = await prisma.contactAttributeKey.findFirst({
      where: {
        key: parsedInput.attributeKey,
        environmentId: contact.environmentId,
      },
    });

    if (!attributeKey) {
      // If key doesn't exist, nothing to delete.
      return { success: true };
    }

    await prisma.contactAttribute.deleteMany({
      where: {
        contactId: parsedInput.contactId,
        attributeKeyId: attributeKey.id,
      },
    });

    return { success: true };
  });

const ZGeneratePersonalSurveyLinkAction = z.object({
  contactId: ZId,
  surveyId: ZId,
  expirationDays: z.number().optional(),
});

export const generatePersonalSurveyLinkAction = authenticatedActionClient
  .schema(ZGeneratePersonalSurveyLinkAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromContactId(parsedInput.contactId);
    const projectId = await getProjectIdFromContactId(parsedInput.contactId);

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
          minPermission: "readWrite",
          projectId,
        },
      ],
    });

    const result = await getContactSurveyLink(
      parsedInput.contactId,
      parsedInput.surveyId,
      parsedInput.expirationDays
    );

    if (!result.ok) {
      if (result.error.type === "not_found") {
        throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
      }
      if (result.error.type === "bad_request") {
        const errorMessage = result.error.details?.[0]?.issue || "Invalid request";
        throw new InvalidInputError(errorMessage);
      }
      const errorMessage = result.error.details?.[0]?.issue || "Failed to generate personal survey link";
      throw new InvalidInputError(errorMessage);
    }

    return {
      surveyUrl: result.data,
    };
  });
