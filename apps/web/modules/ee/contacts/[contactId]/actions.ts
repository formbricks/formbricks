"use server";

import { revalidatePath } from "next/cache";
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
import { getContact } from "@/modules/ee/contacts/lib/contacts";

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

const ZUpdateContactAttributesAction = z.object({
  contactId: ZId,
  attributes: ZContactAttributes,
});

export const updateContactAttributesAction = authenticatedActionClient
  .schema(ZUpdateContactAttributesAction)
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

    const contact = await getContact(parsedInput.contactId);
    if (!contact) {
      throw new ResourceNotFoundError("Contact", parsedInput.contactId);
    }

    // Get userId from contact attributes
    const userIdAttribute = await prisma.contactAttribute.findFirst({
      where: {
        contactId: parsedInput.contactId,
        attributeKey: { key: "userId" },
      },
      select: { value: true },
    });

    if (!userIdAttribute) {
      throw new InvalidInputError("Contact does not have a userId attribute");
    }

    const result = await updateAttributes(
      parsedInput.contactId,
      userIdAttribute.value,
      contact.environmentId,
      parsedInput.attributes
    );

    revalidatePath(`/environments/${contact.environmentId}/contacts/${parsedInput.contactId}`);

    return result;
  });

const ZDeleteContactAttributeAction = z.object({
  contactId: ZId,
  attributeKey: z.string(),
});

export const deleteContactAttributeAction = authenticatedActionClient
  .schema(ZDeleteContactAttributeAction)
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

    const contact = await getContact(parsedInput.contactId);
    if (!contact) {
      throw new ResourceNotFoundError("Contact", parsedInput.contactId);
    }

    // Delete the attribute
    await prisma.contactAttribute.deleteMany({
      where: {
        contactId: parsedInput.contactId,
        attributeKey: { key: parsedInput.attributeKey },
      },
    });

    revalidatePath(`/environments/${contact.environmentId}/contacts/${parsedInput.contactId}`);

    return { success: true };
  });
