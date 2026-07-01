import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  UniqueConstraintError,
} from "@formbricks/types/errors";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { TResponse, TResponseInput, ZResponseInput } from "@formbricks/types/responses";
import {
  buildClientResponse,
  createResponseWithQuotaEvaluation as createClientResponseWithQuotaEvaluation,
} from "@/app/api/client/[workspaceId]/responses/lib/response";
import {
  isDisplayIdUniqueConstraintError,
  isSingleUseIdUniqueConstraintError,
} from "@/app/api/client/[workspaceId]/responses/lib/response-error";
import { buildPrismaResponseData } from "@/app/api/v1/lib/utils";
import { assertDisplayOwnership } from "@/lib/display/service";
import { getOrganization } from "@/lib/organization/service";
import { calculateTtcTotal } from "@/lib/response/utils";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { isPrismaKnownRequestError } from "@/lib/utils/prisma-error";
import { validateInputs } from "@/lib/utils/validate";
import { getContactByUserId } from "./contact";

export const responseSelection = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  finished: true,
  data: true,
  meta: true,
  ttc: true,
  variables: true,
  contactAttributes: true,
  singleUseId: true,
  language: true,
  displayId: true,
  endingId: true,
  contact: {
    select: {
      id: true,
      attributes: {
        select: { attributeKey: true, value: true },
      },
    },
  },
  tags: {
    select: {
      tag: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          name: true,
          workspaceId: true,
        },
      },
    },
  },
} satisfies Prisma.ResponseSelect;

export const createResponseWithQuotaEvaluation = async (
  responseInput: TResponseInput
): Promise<TResponseWithQuotaFull> => {
  return await createClientResponseWithQuotaEvaluation(responseInput, createResponse);
};

export const createResponse = async (
  responseInput: TResponseInput,
  tx: Prisma.TransactionClient
): Promise<TResponse> => {
  validateInputs([responseInput, ZResponseInput]);

  const { workspaceId, userId, finished, ttc: initialTtc } = responseInput;

  try {
    let contact: { id: string; attributes: TContactAttributes } | null = null;

    const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
    const organization = await getOrganization(organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", organizationId);
    }

    if (userId) {
      contact = await getContactByUserId(workspaceId, userId);
    }

    const ttc = initialTtc ? (finished ? calculateTtcTotal(initialTtc) : initialTtc) : {};

    if (responseInput.displayId) {
      await assertDisplayOwnership(
        responseInput.displayId,
        workspaceId,
        responseInput.surveyId,
        contact?.id ?? null,
        tx
      );
    }

    const prismaData = buildPrismaResponseData(
      { ...responseInput, createdAt: undefined, updatedAt: undefined },
      contact,
      ttc
    );

    const prismaClient = tx ?? prisma;

    const responsePrisma = await prismaClient.response.create({
      data: prismaData,
      select: responseSelection,
    });

    return buildClientResponse(responsePrisma, contact);
  } catch (error) {
    if (isPrismaKnownRequestError(error)) {
      if (isDisplayIdUniqueConstraintError(error)) {
        throw new InvalidInputError(`Display ${responseInput.displayId} is already linked to a response`);
      }
      if (isSingleUseIdUniqueConstraintError(error)) {
        throw new UniqueConstraintError("Response already submitted for this single-use link");
      }

      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
