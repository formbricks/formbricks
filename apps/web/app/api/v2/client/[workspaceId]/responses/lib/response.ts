import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { TResponse, ZResponseInput } from "@formbricks/types/responses";
import {
  buildClientResponse,
  createResponseWithQuotaEvaluation as createClientResponseWithQuotaEvaluation,
} from "@/app/api/client/[workspaceId]/responses/lib/response";
import { handleClientResponseCreateError } from "@/app/api/client/[workspaceId]/responses/lib/response-error";
import { responseSelection } from "@/app/api/v1/client/[workspaceId]/responses/lib/response";
import { buildPrismaResponseData as buildV1PrismaResponseData } from "@/app/api/v1/lib/utils";
import { TResponseInputV2 } from "@/app/api/v2/client/[workspaceId]/responses/types/response";
import { assertDisplayOwnership } from "@/lib/display/service";
import { getOrganization } from "@/lib/organization/service";
import { calculateTtcTotal } from "@/lib/response/utils";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { validateInputs } from "@/lib/utils/validate";
import { getContact } from "./contact";

export const createResponseWithQuotaEvaluation = async (
  responseInput: TResponseInputV2
): Promise<TResponseWithQuotaFull> => {
  return await createClientResponseWithQuotaEvaluation(responseInput, createResponse);
};

const buildPrismaResponseData = (
  responseInput: TResponseInputV2,
  contact: { id: string; attributes: TContactAttributes } | null,
  ttc: Record<string, number>
): Prisma.ResponseCreateInput => {
  // Reuses the v1 builder but drops caller-supplied timestamps: unlike the v1 management create,
  // the public client create must not let respondents backdate responses
  return {
    ...buildV1PrismaResponseData(responseInput, contact, ttc),
    createdAt: undefined,
    updatedAt: undefined,
  };
};

export const createResponse = async (
  responseInput: TResponseInputV2,
  tx?: Prisma.TransactionClient
): Promise<TResponse> => {
  validateInputs([responseInput, ZResponseInput]);

  const { workspaceId, contactId, finished, ttc: initialTtc } = responseInput;

  try {
    let contact: { id: string; attributes: TContactAttributes } | null = null;

    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
    const organization = await getOrganization(organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", null);
    }

    if (contactId) {
      contact = await getContact(contactId, workspaceId);
    }

    const ttc = initialTtc ? (finished ? calculateTtcTotal(initialTtc) : initialTtc) : {};

    if (responseInput.displayId) {
      await assertDisplayOwnership(
        responseInput.displayId,
        workspaceId,
        responseInput.surveyId,
        contactId ?? null,
        tx
      );
    }

    const prismaData = buildPrismaResponseData(responseInput, contact, ttc);

    const prismaClient = tx ?? prisma;

    const responsePrisma = await prismaClient.response.create({
      data: prismaData,
      select: responseSelection,
    });

    return buildClientResponse(responsePrisma, contact);
  } catch (error) {
    return handleClientResponseCreateError(error, responseInput.displayId);
  }
};
