import "server-only";
import { getContactByEmail } from "@/app/api/v1/client/[environmentId]/responses/lib/contact";
import { responseSelection } from "@/app/api/v1/client/[environmentId]/responses/lib/response";
import { TResponseInputV2 } from "@/app/api/v2/client/[environmentId]/responses/types/response";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@/lib/organization/service";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@/lib/posthogServer";
import { calculateTtcTotal } from "@/lib/response/utils";
import { captureTelemetry } from "@/lib/telemetry";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponse, ZResponseInput } from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";
import { getContact } from "./contact";

export const createResponse = async (responseInput: TResponseInputV2): Promise<TResponse> => {
  validateInputs([responseInput, ZResponseInput]);
  captureTelemetry("response created");

  const {
    environmentId,
    language,
    contactId,
    email,
    surveyId,
    displayId,
    endingId,
    finished,
    data,
    meta,
    singleUseId,
    variables,
    ttc: initialTtc,
    createdAt,
    updatedAt,
  } = responseInput;

  try {
    let contact: { id: string; attributes: TContactAttributes } | null = null;

    const organization = await getOrganizationByEnvironmentId(environmentId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", environmentId);
    }

    if (contactId) {
      contact = await getContact(contactId);
    } else if (email) {
      contact = await getContactByEmail(environmentId, email);
    }

    const ttc = initialTtc ? (finished ? calculateTtcTotal(initialTtc) : initialTtc) : {};

    const prismaData: Prisma.ResponseCreateInput = {
      survey: {
        connect: {
          id: surveyId,
        },
      },
      display: displayId ? { connect: { id: displayId } } : undefined,
      finished,
      endingId,
      data: data,
      language: language,
      ...(contact?.id && {
        contact: {
          connect: {
            id: contact.id,
          },
        },
        contactAttributes: contact.attributes,
      }),
      ...(meta && ({ meta } as Prisma.JsonObject)),
      singleUseId,
      ...(variables && { variables }),
      ttc: ttc,
      createdAt,
      updatedAt,
    };

    const responsePrisma = await prisma.response.create({
      data: prismaData,
      select: responseSelection,
    });

    const response: TResponse = {
      ...responsePrisma,
      contact: contact
        ? {
            id: contact.id,
            userId: contact.attributes.userId,
          }
        : null,
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    if (IS_FORMBRICKS_CLOUD) {
      const responsesCount = await getMonthlyOrganizationResponseCount(organization.id);
      const responsesLimit = organization.billing.limits.monthly.responses;

      if (responsesLimit && responsesCount >= responsesLimit) {
        try {
          await sendPlanLimitsReachedEventToPosthogWeekly(environmentId, {
            plan: organization.billing.plan,
            limits: {
              projects: null,
              monthly: {
                responses: responsesLimit,
                miu: null,
              },
            },
          });
        } catch (err) {
          // Log error but do not throw
          logger.error(err, "Error sending plan limits reached event to Posthog");
        }
      }
    }

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
