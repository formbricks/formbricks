import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TResponse,
  TResponseContact,
  TResponseFilterCriteria,
  TResponseUpdateInput,
  TResponseWithQuotas,
  ZResponseFilterCriteria,
  ZResponseUpdateInput,
} from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { reduceQuotaLimits } from "@/modules/ee/quotas/lib/quotas";
import { deleteFile } from "@/modules/storage/service";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { getOrganizationIdFromEnvironmentId } from "@/modules/survey/lib/organization";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { ITEMS_PER_PAGE } from "../constants";
import { deleteDisplay } from "../display/service";
import { getSurvey } from "../survey/service";
import { convertToCsv, convertToXlsxBuffer } from "../utils/file-conversion";
import { validateInputs } from "../utils/validate";
import {
  buildWhereClause,
  calculateTtcTotal,
  extractSurveyDetails,
  getResponseContactAttributes,
  getResponseHiddenFields,
  getResponseMeta,
  getResponsesFileName,
  getResponsesJson,
} from "./utils";

const RESPONSES_PER_PAGE = 10;

export const responseSelection = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  finished: true,
  endingId: true,
  data: true,
  meta: true,
  ttc: true,
  variables: true,
  contactAttributes: true,
  singleUseId: true,
  language: true,
  displayId: true,
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
          environmentId: true,
        },
      },
    },
  },
} satisfies Prisma.ResponseSelect;

export const getResponseContact = (
  responsePrisma: Prisma.ResponseGetPayload<{ select: typeof responseSelection }>
): TResponseContact | null => {
  if (!responsePrisma.contact) return null;

  return {
    id: responsePrisma.contact.id,
    userId: responsePrisma.contact.attributes.find((attribute) => attribute.attributeKey.key === "userId")
      ?.value as string,
  };
};

export const getResponsesByContactId = reactCache(
  async (contactId: string, page?: number): Promise<TResponseWithQuotas[]> => {
    validateInputs([contactId, ZId], [page, ZOptionalNumber]);

    try {
      const responsePrisma = await prisma.response.findMany({
        where: {
          contactId,
        },
        select: {
          ...responseSelection,
          quotaLinks: {
            where: {
              status: "screenedIn",
            },
            include: {
              quota: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        orderBy: {
          createdAt: "desc",
        },
      });

      let responses: TResponseWithQuotas[] = [];

      await Promise.all(
        responsePrisma.map(async (response) => {
          const responseContact: TResponseContact = {
            id: response.contact?.id as string,
            userId: response.contact?.attributes.find((attribute) => attribute.attributeKey.key === "userId")
              ?.value as string,
          };

          responses.push({
            ...response,
            contact: responseContact,

            tags: response.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
            quotas: response.quotaLinks.map((quotaLinkPrisma) => quotaLinkPrisma.quota),
          });
        })
      );

      return responses;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getResponseBySingleUseId = reactCache(
  async (surveyId: string, singleUseId: string): Promise<TResponse | null> => {
    validateInputs([surveyId, ZId], [singleUseId, ZString]);

    try {
      const responsePrisma = await prisma.response.findUnique({
        where: {
          surveyId_singleUseId: { surveyId, singleUseId },
        },
        select: responseSelection,
      });

      if (!responsePrisma) {
        return null;
      }

      const response: TResponse = {
        ...responsePrisma,
        contact: getResponseContact(responsePrisma),
        tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
      };

      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getResponse = reactCache(async (responseId: string): Promise<TResponse | null> => {
  validateInputs([responseId, ZId]);

  try {
    const responsePrisma = await prisma.response.findUnique({
      where: {
        id: responseId,
      },
      select: responseSelection,
    });

    if (!responsePrisma) {
      return null;
    }

    const response: TResponse = {
      ...responsePrisma,
      contact: getResponseContact(responsePrisma),
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const getResponseFilteringValues = reactCache(async (surveyId: string) => {
  validateInputs([surveyId, ZId]);

  try {
    const survey = await getSurvey(surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    const responses = await prisma.response.findMany({
      where: {
        surveyId,
      },
      select: {
        data: true,
        meta: true,
        contactAttributes: true,
      },
    });

    const contactAttributes = getResponseContactAttributes(responses);
    const meta = getResponseMeta(responses);
    const hiddenFields = getResponseHiddenFields(survey, responses);

    return { contactAttributes, meta, hiddenFields };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const getResponses = reactCache(
  async (
    surveyId: string,
    limit?: number,
    offset?: number,
    filterCriteria?: TResponseFilterCriteria,
    cursor?: string
  ): Promise<TResponseWithQuotas[]> => {
    validateInputs(
      [surveyId, ZId],
      [limit, ZOptionalNumber],
      [offset, ZOptionalNumber],
      [filterCriteria, ZResponseFilterCriteria.optional()],
      [cursor, z.string().cuid2().optional()]
    );

    limit = limit ?? RESPONSES_PER_PAGE;
    const survey = await getSurvey(surveyId);
    if (!survey) return [];
    try {
      const whereClause: Prisma.ResponseWhereInput = {
        surveyId,
        ...buildWhereClause(survey, filterCriteria),
      };

      // Add cursor condition for cursor-based pagination
      if (cursor) {
        whereClause.id = {
          lt: cursor, // Get responses with ID less than cursor (for desc order)
        };
      }

      const responses = await prisma.response.findMany({
        where: whereClause,
        select: {
          ...responseSelection,
          quotaLinks: {
            where: {
              status: "screenedIn",
            },
            include: {
              quota: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc", // Secondary sort by ID for consistent pagination
          },
        ],
        take: limit,
        skip: offset,
      });

      const transformedResponses: TResponseWithQuotas[] = await Promise.all(
        responses.map((responsePrisma) => {
          const { quotaLinks, ...response } = responsePrisma;
          return {
            ...response,
            contact: getResponseContact(responsePrisma),
            tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
            quotas: quotaLinks.map((quotaLinkPrisma) => quotaLinkPrisma.quota),
          };
        })
      );

      return transformedResponses;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const getResponseDownloadFile = async (
  surveyId: string,
  format: "csv" | "xlsx",
  filterCriteria?: TResponseFilterCriteria
): Promise<{ fileContents: string; fileName: string }> => {
  validateInputs([surveyId, ZId], [format, ZString], [filterCriteria, ZResponseFilterCriteria.optional()]);
  try {
    const survey = await getSurvey(surveyId);

    if (!survey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    const batchSize = 3000;

    // Use cursor-based pagination instead of count + offset to avoid expensive queries
    const responses: TResponse[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const batch = await getResponses(surveyId, batchSize, 0, filterCriteria, cursor);
      responses.push(...batch);

      if (batch.length < batchSize) {
        hasMore = false;
      } else {
        // Use the last response's ID as cursor for next batch
        cursor = batch[batch.length - 1].id;
      }
    }

    const { metaDataFields, elements, hiddenFields, variables, userAttributes } = extractSurveyDetails(
      survey,
      responses
    );

    const organizationId = await getOrganizationIdFromEnvironmentId(survey.environmentId);
    if (!organizationId) {
      throw new Error("Organization ID not found");
    }

    const organizationBilling = await getOrganizationBilling(organizationId);

    if (!organizationBilling) {
      throw new Error("Organization billing not found");
    }
    const isQuotasAllowed = await getIsQuotasEnabled(organizationBilling.plan);

    const headers = [
      "No.",
      "Response ID",
      "Timestamp",
      "Finished",
      ...(isQuotasAllowed ? ["Quotas"] : []),
      "Survey ID",
      "Formbricks ID (internal)",
      "User ID",
      "Tags",
      ...metaDataFields,
      ...elements.flat(),
      ...variables,
      ...hiddenFields,
      ...userAttributes,
    ];

    if (survey.isVerifyEmailEnabled) {
      headers.push("Verified Email");
    }
    const resolvedResponses = responses.map((r) => ({ ...r, data: resolveStorageUrlsInObject(r.data) }));
    const jsonData = getResponsesJson(
      survey,
      resolvedResponses,
      elements,
      userAttributes,
      hiddenFields,
      isQuotasAllowed
    );

    const fileName = getResponsesFileName(survey?.name || "", format);
    let fileContents: string;

    if (format === "xlsx") {
      const buffer = convertToXlsxBuffer(headers, jsonData);
      fileContents = buffer.toString("base64");
    } else {
      fileContents = await convertToCsv(headers, jsonData);
    }

    return {
      fileContents,
      fileName,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponsesByEnvironmentId = reactCache(
  async (environmentId: string, limit?: number, offset?: number): Promise<TResponse[]> => {
    validateInputs([environmentId, ZId], [limit, ZOptionalNumber], [offset, ZOptionalNumber]);

    try {
      const responses = await prisma.response.findMany({
        where: {
          survey: {
            environmentId,
          },
        },
        select: responseSelection,
        orderBy: [
          {
            createdAt: "desc",
          },
        ],
        take: limit,
        skip: offset,
      });

      const transformedResponses: TResponse[] = await Promise.all(
        responses.map(async (responsePrisma) => {
          return {
            ...responsePrisma,
            contact: getResponseContact(responsePrisma),
            tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
          };
        })
      );

      return transformedResponses;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);

export const updateResponse = async (
  responseId: string,
  responseInput: TResponseUpdateInput,
  tx?: Prisma.TransactionClient
): Promise<TResponse> => {
  validateInputs([responseId, ZId], [responseInput, ZResponseUpdateInput]);
  try {
    const prismaClient = tx ?? prisma;
    // use direct prisma call to avoid cache issues
    const currentResponse = await prismaClient.response.findUnique({
      where: {
        id: responseId,
      },
      select: responseSelection,
    });

    if (!currentResponse) {
      throw new ResourceNotFoundError("Response", responseId);
    }

    // merge data object
    const data = {
      ...currentResponse.data,
      ...responseInput.data,
    };
    // merge ttc object (similar to data) to preserve TTC from previous blocks
    const currentTtc = currentResponse.ttc;
    const mergedTtc = responseInput.ttc
      ? {
          ...currentTtc,
          ...responseInput.ttc,
        }
      : currentTtc;
    // Calculate total only when finished
    const ttc = responseInput.finished ? calculateTtcTotal(mergedTtc) : mergedTtc;
    const language = responseInput.language;
    const variables = {
      ...currentResponse.variables,
      ...responseInput.variables,
    };

    const responsePrisma = await prismaClient.response.update({
      where: {
        id: responseId,
      },
      data: {
        finished: responseInput.finished,
        endingId: responseInput.endingId,
        data,
        ttc,
        language,
        variables,
      },
      select: responseSelection,
    });

    const response: TResponse = {
      ...responsePrisma,
      contact: getResponseContact(responsePrisma),
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

const findAndDeleteUploadedFilesInResponse = async (response: TResponse, survey: TSurvey): Promise<void> => {
  const elements = getElementsFromBlocks(survey.blocks);

  const fileUploadElements = new Set(
    elements.filter((element) => element.type === TSurveyElementTypeEnum.FileUpload).map((q) => q.id)
  );

  const fileUrls = Object.entries(response.data)
    .filter(([elementId]) => fileUploadElements.has(elementId))
    .flatMap(([, elementResponse]) => elementResponse as string[]);

  const deletionPromises = fileUrls.map(async (fileUrl) => {
    try {
      const { pathname } = new URL(fileUrl);
      const [, environmentId, accessType, fileName] = pathname.split("/").filter(Boolean);

      if (!environmentId || !accessType || !fileName) {
        throw new Error(`Invalid file path: ${pathname}`);
      }

      return deleteFile(environmentId, accessType as "private" | "public", fileName);
    } catch (error) {
      logger.error(error, `Failed to delete file ${fileUrl}`);
    }
  });

  await Promise.all(deletionPromises);
};

export const deleteResponse = async (
  responseId: string,
  decrementQuotas: boolean = false
): Promise<TResponse> => {
  validateInputs([responseId, ZId]);
  try {
    const txResponse = await prisma.$transaction(async (tx) => {
      const responsePrisma = await tx.response.delete({
        where: {
          id: responseId,
        },
        select: {
          ...responseSelection,
          quotaLinks: {
            where: {
              status: "screenedIn",
            },
            include: {
              quota: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      const { quotaLinks, ...responseWithoutQuotas } = responsePrisma;

      const response: TResponse = {
        ...responseWithoutQuotas,
        contact: getResponseContact(responsePrisma),
        tags: responseWithoutQuotas.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
      };

      if (response.displayId) {
        await deleteDisplay(response.displayId, tx);
      }

      if (decrementQuotas) {
        const quotaIds = quotaLinks?.map((link) => link.quota.id) ?? [];
        await reduceQuotaLimits(quotaIds, tx);
      }

      return response;
    });

    const survey = await getSurvey(txResponse.surveyId);

    if (survey) {
      await findAndDeleteUploadedFilesInResponse(txResponse, survey);
    }

    return txResponse;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponseCountBySurveyId = reactCache(
  async (surveyId: string, filterCriteria?: TResponseFilterCriteria): Promise<number> => {
    validateInputs([surveyId, ZId], [filterCriteria, ZResponseFilterCriteria.optional()]);

    try {
      const survey = await getSurvey(surveyId);
      if (!survey) return 0;

      const responseCount = await prisma.response.count({
        where: {
          surveyId: surveyId,
          ...buildWhereClause(survey, filterCriteria),
        },
      });
      return responseCount;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }

      throw error;
    }
  }
);
