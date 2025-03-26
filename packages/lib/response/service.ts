import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TResponse,
  TResponseContact,
  TResponseFilterCriteria,
  TResponseUpdateInput,
  ZResponseFilterCriteria,
  ZResponseUpdateInput,
} from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { cache } from "../cache";
import { ITEMS_PER_PAGE, WEBAPP_URL } from "../constants";
import { deleteDisplay } from "../display/service";
import { responseNoteCache } from "../responseNote/cache";
import { getResponseNotes } from "../responseNote/service";
import { deleteFile, putFile } from "../storage/service";
import { getSurvey } from "../survey/service";
import { convertToCsv, convertToXlsxBuffer } from "../utils/fileConversion";
import { validateInputs } from "../utils/validate";
import { responseCache } from "./cache";
import {
  InconsistentQuestion,
  ResponseConsistencyResult,
  buildWhereClause,
  calculateTtcTotal,
  extractSurveyDetails,
  getExpectedResponseType,
  getResponseContactAttributes,
  getResponseHiddenFields,
  getResponseMeta,
  getResponsesFileName,
  getResponsesJson,
  getValueType,
  isTypeValid,
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
  notes: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      text: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      isResolved: true,
      isEdited: true,
    },
  },
} satisfies Prisma.ResponseSelect;

const getResponseContact = (
  responsePrisma: Prisma.ResponseGetPayload<{ select: typeof responseSelection }>
): TResponseContact | null => {
  if (!responsePrisma.contact) return null;

  return {
    id: responsePrisma.contact.id as string,
    userId: responsePrisma.contact.attributes.find((attribute) => attribute.attributeKey.key === "userId")
      ?.value as string,
  };
};

export const getResponsesByContactId = reactCache(
  (contactId: string, page?: number): Promise<TResponse[] | null> =>
    cache(
      async () => {
        validateInputs([contactId, ZId], [page, ZOptionalNumber]);

        try {
          const responsePrisma = await prisma.response.findMany({
            where: {
              contactId,
            },
            select: responseSelection,
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
            orderBy: {
              createdAt: "desc",
            },
          });

          if (!responsePrisma) {
            throw new ResourceNotFoundError("Response from ContactId", contactId);
          }

          let responses: TResponse[] = [];

          await Promise.all(
            responsePrisma.map(async (response) => {
              const responseNotes = await getResponseNotes(response.id);
              const responseContact: TResponseContact = {
                id: response.contact?.id as string,
                userId: response.contact?.attributes.find(
                  (attribute) => attribute.attributeKey.key === "userId"
                )?.value as string,
              };

              responses.push({
                ...response,
                contact: responseContact,
                notes: responseNotes,
                tags: response.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
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
      },
      [`getResponsesByContactId-${contactId}-${page}`],
      {
        tags: [responseCache.tag.byContactId(contactId)],
      }
    )()
);

export const getResponseBySingleUseId = reactCache(
  async (surveyId: string, singleUseId: string): Promise<TResponse | null> =>
    cache(
      async () => {
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
      },
      [`getResponseBySingleUseId-${surveyId}-${singleUseId}`],
      {
        tags: [responseCache.tag.bySingleUseId(surveyId, singleUseId)],
      }
    )()
);

export const getResponse = reactCache(
  async (responseId: string): Promise<TResponse | null> =>
    cache(
      async () => {
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
      },
      [`getResponse-${responseId}`],
      {
        tags: [responseCache.tag.byId(responseId), responseNoteCache.tag.byResponseId(responseId)],
      }
    )()
);

export const getResponseFilteringValues = reactCache(async (surveyId: string) =>
  cache(
    async () => {
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
    },
    [`getResponseFilteringValues-${surveyId}`],
    {
      tags: [responseCache.tag.bySurveyId(surveyId)],
    }
  )()
);

export const getResponses = reactCache(
  async (
    surveyId: string,
    limit?: number,
    offset?: number,
    filterCriteria?: TResponseFilterCriteria
  ): Promise<TResponse[]> =>
    cache(
      async () => {
        validateInputs(
          [surveyId, ZId],
          [limit, ZOptionalNumber],
          [offset, ZOptionalNumber],
          [filterCriteria, ZResponseFilterCriteria.optional()]
        );

        limit = limit ?? RESPONSES_PER_PAGE;
        const survey = await getSurvey(surveyId);
        if (!survey) return [];
        try {
          const responses = await prisma.response.findMany({
            where: {
              surveyId,
              ...buildWhereClause(survey, filterCriteria),
            },
            select: responseSelection,
            orderBy: [
              {
                createdAt: "desc",
              },
            ],
            take: limit ? limit : undefined,
            skip: offset ? offset : undefined,
          });

          const transformedResponses: TResponse[] = await Promise.all(
            responses.map((responsePrisma) => {
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
      },
      [`getResponses-${surveyId}-${limit}-${offset}-${JSON.stringify(filterCriteria)}`],
      {
        tags: [responseCache.tag.bySurveyId(surveyId)],
      }
    )()
);

export const getResponseDownloadUrl = async (
  surveyId: string,
  format: "csv" | "xlsx",
  filterCriteria?: TResponseFilterCriteria
): Promise<string> => {
  validateInputs([surveyId, ZId], [format, ZString], [filterCriteria, ZResponseFilterCriteria.optional()]);
  try {
    const survey = await getSurvey(surveyId);

    if (!survey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    const environmentId = survey.environmentId as string;

    const accessType = "private";
    const batchSize = 3000;
    const responseCount = await getResponseCountBySurveyId(surveyId, filterCriteria);
    const pages = Math.ceil(responseCount / batchSize);

    const responsesArray = await Promise.all(
      Array.from({ length: pages }, (_, i) => {
        return getResponses(surveyId, batchSize, i * batchSize, filterCriteria);
      })
    );
    const responses = responsesArray.flat();

    const { metaDataFields, questions, hiddenFields, variables, userAttributes } = extractSurveyDetails(
      survey,
      responses
    );

    const headers = [
      "No.",
      "Response ID",
      "Timestamp",
      "Finished",
      "Survey ID",
      "Formbricks ID (internal)",
      "User ID",
      "Notes",
      "Tags",
      ...metaDataFields,
      ...questions,
      ...variables,
      ...hiddenFields,
      ...userAttributes,
    ];

    if (survey.isVerifyEmailEnabled) {
      headers.push("Verified Email");
    }
    const jsonData = getResponsesJson(survey, responses, questions, userAttributes, hiddenFields);

    const fileName = getResponsesFileName(survey?.name || "", format);
    let fileBuffer: Buffer;

    if (format === "xlsx") {
      fileBuffer = convertToXlsxBuffer(headers, jsonData);
    } else {
      const csvFile = await convertToCsv(headers, jsonData);
      fileBuffer = Buffer.from(csvFile);
    }

    await putFile(fileName, fileBuffer, accessType, environmentId);

    return `${WEBAPP_URL}/storage/${environmentId}/${accessType}/${fileName}`;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponsesByEnvironmentId = reactCache(
  async (environmentId: string, limit?: number, offset?: number): Promise<TResponse[]> =>
    cache(
      async () => {
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
            take: limit ? limit : undefined,
            skip: offset ? offset : undefined,
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
      },
      [`getResponsesByEnvironmentId-${environmentId}-${limit}-${offset}`],
      {
        tags: [responseCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const updateResponse = async (
  responseId: string,
  responseInput: TResponseUpdateInput
): Promise<TResponse> => {
  validateInputs([responseId, ZId], [responseInput, ZResponseUpdateInput]);
  try {
    // const currentResponse = await getResponse(responseId);

    // use direct prisma call to avoid cache issues
    const currentResponse = await prisma.response.findUnique({
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
    const ttc = responseInput.ttc
      ? responseInput.finished
        ? calculateTtcTotal(responseInput.ttc)
        : responseInput.ttc
      : {};
    const language = responseInput.language;
    const variables = {
      ...currentResponse.variables,
      ...responseInput.variables,
    };

    const responsePrisma = await prisma.response.update({
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

    responseCache.revalidate({
      id: response.id,
      contactId: response.contact?.id,
      surveyId: response.surveyId,
    });

    responseNoteCache.revalidate({
      responseId: response.id,
    });

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

const findAndDeleteUploadedFilesInResponse = async (response: TResponse, survey: TSurvey): Promise<void> => {
  const fileUploadQuestions = new Set(
    survey.questions
      .filter((question) => question.type === TSurveyQuestionTypeEnum.FileUpload)
      .map((q) => q.id)
  );

  const fileUrls = Object.entries(response.data)
    .filter(([questionId]) => fileUploadQuestions.has(questionId))
    .flatMap(([, questionResponse]) => questionResponse as string[]);

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

export const deleteResponse = async (responseId: string): Promise<TResponse> => {
  validateInputs([responseId, ZId]);
  try {
    const responsePrisma = await prisma.response.delete({
      where: {
        id: responseId,
      },
      select: responseSelection,
    });

    const responseNotes = await getResponseNotes(responsePrisma.id);
    const response: TResponse = {
      ...responsePrisma,
      contact: getResponseContact(responsePrisma),
      notes: responseNotes,
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    if (response.displayId) {
      deleteDisplay(response.displayId);
    }
    const survey = await getSurvey(response.surveyId);

    if (survey) {
      await findAndDeleteUploadedFilesInResponse(
        {
          ...responsePrisma,
          contact: getResponseContact(responsePrisma),
          tags: responsePrisma.tags.map((tag) => tag.tag),
        },
        survey
      );
    }

    responseCache.revalidate({
      environmentId: survey?.environmentId,
      id: response.id,
      contactId: response.contact?.id,
      surveyId: response.surveyId,
    });

    responseNoteCache.revalidate({
      responseId: response.id,
    });

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponseCountBySurveyId = reactCache(
  async (surveyId: string, filterCriteria?: TResponseFilterCriteria): Promise<number> =>
    cache(
      async () => {
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
      },
      [`getResponseCountBySurveyId-${surveyId}-${JSON.stringify(filterCriteria)}`],
      {
        tags: [responseCache.tag.bySurveyId(surveyId)],
      }
    )()
);

/**
 * Checks a survey's responses for data consistency
 * Returns information about inconsistent question responses
 */
export const checkResponseConsistency = async (surveyId: string): Promise<ResponseConsistencyResult> => {
  validateInputs([surveyId, ZId]);

  try {
    const survey = await getSurvey(surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    // Create a map of question IDs to their question types for quick lookup
    const questionTypeMap = new Map<string, TSurveyQuestionTypeEnum>();
    survey.questions.forEach((question) => {
      questionTypeMap.set(question.id, question.type as TSurveyQuestionTypeEnum);
    });

    // Create a set of valid field IDs (question IDs + hidden field IDs)
    const validFieldIds = new Set<string>([
      ...survey.questions.map((q) => q.id),
      ...(survey.hiddenFields.fieldIds || []),
    ]);

    // Get all responses for this survey
    // We need direct DB access for all responses, not paginated
    const responsesData = await prisma.response.findMany({
      where: {
        surveyId,
      },
      select: {
        id: true,
        data: true,
      },
    });

    if (responsesData.length === 0) {
      return {
        hasInconsistencies: false,
        inconsistentQuestions: [],
        unknownFields: [],
      };
    }

    // Track type frequencies for each question
    const questionTypeFrequencies: Record<string, Record<string, number>> = {};
    const unknownFields: Set<string> = new Set();

    // Analyze each response
    responsesData.forEach((response) => {
      const responseData = response.data as Record<string, unknown>;

      // Check each field in the response
      Object.entries(responseData).forEach(([fieldId, value]) => {
        // Check if this is a valid field
        if (!validFieldIds.has(fieldId)) {
          unknownFields.add(fieldId);
          return;
        }

        const valueType = getValueType(value);

        // Initialize type frequency counter for this question if needed
        if (!questionTypeFrequencies[fieldId]) {
          questionTypeFrequencies[fieldId] = {};
        }

        // Increment the frequency counter for this type
        questionTypeFrequencies[fieldId][valueType] = (questionTypeFrequencies[fieldId][valueType] || 0) + 1;
      });
    });

    // Find questions with inconsistent types
    const inconsistentQuestions: InconsistentQuestion[] = [];

    Object.entries(questionTypeFrequencies).forEach(([questionId, typeFreq]) => {
      const types = Object.keys(typeFreq);

      // If there's only one type, it's consistent (but might still be wrong)
      if (types.length <= 1) return;

      // This question has multiple types - it's inconsistent
      const questionType = questionTypeMap.get(questionId);
      const expectedType = questionType
        ? getExpectedResponseType(questionType)
        : ["string", "array", "object", "number", "boolean"]; // For hidden fields, allow any type

      const question = survey.questions.find((q) => q.id === questionId);

      inconsistentQuestions.push({
        questionId,
        headline: question?.headline?.default,
        expectedType,
        foundTypes: typeFreq,
        totalResponses: responsesData.length,
      });
    });

    return {
      hasInconsistencies: inconsistentQuestions.length > 0 || unknownFields.size > 0,
      inconsistentQuestions,
      unknownFields: Array.from(unknownFields),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
