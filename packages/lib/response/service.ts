import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TAttributes } from "@formbricks/types/attributes";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TPerson } from "@formbricks/types/people";
import {
  TResponse,
  TResponseFilterCriteria,
  TResponseInput,
  TResponseUpdateInput,
  ZResponseFilterCriteria,
  ZResponseInput,
  ZResponseUpdateInput,
} from "@formbricks/types/responses";
import {
  TSurvey,
  TSurveyQuestionTypeEnum,
  TSurveyQuestions,
  TSurveySummary,
  ZSurveyQuestions,
} from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { getAttributes } from "../attribute/service";
import { cache } from "../cache";
import { IS_FORMBRICKS_CLOUD, ITEMS_PER_PAGE, WEBAPP_URL } from "../constants";
import { displayCache } from "../display/cache";
import { deleteDisplay, getDisplayCountBySurveyId } from "../display/service";
import { createDocument, doesDocumentExistForResponseId } from "../document/service";
import { getMonthlyOrganizationResponseCount, getOrganizationByEnvironmentId } from "../organization/service";
import { createPerson, getPersonByUserId } from "../person/service";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "../posthogServer";
import { responseNoteCache } from "../responseNote/cache";
import { getResponseNotes } from "../responseNote/service";
import { deleteFile, putFile } from "../storage/service";
import { surveyCache } from "../survey/cache";
import { getSurvey } from "../survey/service";
import { captureTelemetry } from "../telemetry";
import { getPromptText } from "../utils/ai";
import { convertToCsv, convertToXlsxBuffer } from "../utils/fileConversion";
import { validateInputs } from "../utils/validate";
import { responseCache } from "./cache";
import {
  buildWhereClause,
  calculateTtcTotal,
  doesThisResponseHasAnyOpenTextAnswer,
  extractSurveyDetails,
  getQuestionWiseSummary,
  getResponseHiddenFields,
  getResponseMeta,
  getResponsePersonAttributes,
  getResponsesFileName,
  getResponsesJson,
  getSurveySummaryDropOff,
  getSurveySummaryMeta,
} from "./utils";

const RESPONSES_PER_PAGE = 10;

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
  personAttributes: true,
  singleUseId: true,
  language: true,
  displayId: true,
  person: {
    select: {
      id: true,
      userId: true,
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

export const getResponsesByPersonId = reactCache(
  (personId: string, page?: number): Promise<TResponse[] | null> =>
    cache(
      async () => {
        validateInputs([personId, ZId], [page, ZOptionalNumber]);

        try {
          const responsePrisma = await prisma.response.findMany({
            where: {
              personId,
            },
            select: responseSelection,
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
            orderBy: {
              createdAt: "desc",
            },
          });

          if (!responsePrisma) {
            throw new ResourceNotFoundError("Response from PersonId", personId);
          }

          let responses: TResponse[] = [];

          await Promise.all(
            responsePrisma.map(async (response) => {
              const responseNotes = await getResponseNotes(response.id);
              responses.push({
                ...response,
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
      [`getResponsesByPersonId-${personId}-${page}`],
      {
        tags: [responseCache.tag.byPersonId(personId)],
      }
    )()
);

export const getResponsesByUserId = reactCache(
  (environmentId: string, userId: string, page?: number): Promise<TResponse[] | null> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [userId, ZString], [page, ZOptionalNumber]);

        const person = await getPersonByUserId(environmentId, userId);

        if (!person) {
          throw new ResourceNotFoundError("Person", userId);
        }

        try {
          const responsePrisma = await prisma.response.findMany({
            where: {
              personId: person.id,
            },
            select: responseSelection,
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
            orderBy: {
              createdAt: "desc",
            },
          });

          if (!responsePrisma) {
            throw new ResourceNotFoundError("Response from PersonId", person.id);
          }

          const responsePromises = responsePrisma.map(async (response) => {
            const tags = response.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag);

            return {
              ...response,
              tags,
            };
          });

          const responses = await Promise.all(responsePromises);
          return responses;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getResponsesByUserId-${environmentId}-${userId}-${page}`],
      {
        tags: [responseCache.tag.byEnvironmentIdAndUserId(environmentId, userId)],
      }
    )()
);

export const getResponseBySingleUseId = reactCache(
  (surveyId: string, singleUseId: string): Promise<TResponse | null> =>
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

export const createResponse = async (responseInput: TResponseInput): Promise<TResponse> => {
  validateInputs([responseInput, ZResponseInput]);
  captureTelemetry("response created");

  const {
    environmentId,
    language,
    userId,
    surveyId,
    displayId,
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
    let person: TPerson | null = null;
    let attributes: TAttributes | null = null;

    const organization = await getOrganizationByEnvironmentId(environmentId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization", environmentId);
    }

    if (userId) {
      person = await getPersonByUserId(environmentId, userId);
      if (!person) {
        // create person if it does not exist
        person = await createPerson(environmentId, userId);
      }
    }

    if (person?.id) {
      attributes = await getAttributes(person?.id as string);
    }

    const ttc = initialTtc ? (finished ? calculateTtcTotal(initialTtc) : initialTtc) : {};

    const prismaData: Prisma.ResponseCreateInput = {
      survey: {
        connect: {
          id: surveyId,
        },
      },
      display: displayId ? { connect: { id: displayId } } : undefined,
      finished: finished,
      data: data,
      language: language,
      ...(person?.id && {
        person: {
          connect: {
            id: person.id,
          },
        },
        personAttributes: attributes,
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
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    responseCache.revalidate({
      environmentId: environmentId,
      id: response.id,
      personId: response.person?.id,
      userId: userId ?? undefined,
      surveyId: response.surveyId,
      singleUseId: singleUseId ? singleUseId : undefined,
    });

    responseNoteCache.revalidate({
      responseId: response.id,
    });

    if (IS_FORMBRICKS_CLOUD) {
      const responsesCount = await getMonthlyOrganizationResponseCount(organization.id);
      const responsesLimit = organization.billing.limits.monthly.responses;

      if (responsesLimit && responsesCount >= responsesLimit) {
        try {
          await sendPlanLimitsReachedEventToPosthogWeekly(environmentId, {
            plan: organization.billing.plan,
            limits: {
              monthly: {
                responses: responsesLimit,
                miu: null,
              },
            },
          });
        } catch (err) {
          // Log error but do not throw
          console.error(`Error sending plan limits reached event to Posthog: ${err}`);
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

export const getResponse = reactCache(
  (responseId: string): Promise<TResponse | null> =>
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

export const getResponseFilteringValues = reactCache((surveyId: string) =>
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
            personAttributes: true,
          },
        });

        const personAttributes = getResponsePersonAttributes(responses);
        const meta = getResponseMeta(responses);
        const hiddenFields = getResponseHiddenFields(survey, responses);

        return { personAttributes, meta, hiddenFields };
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
  (
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

export const getSurveySummary = reactCache(
  (surveyId: string, filterCriteria?: TResponseFilterCriteria): Promise<TSurveySummary> =>
    cache(
      async () => {
        validateInputs([surveyId, ZId], [filterCriteria, ZResponseFilterCriteria.optional()]);

        try {
          const survey = await getSurvey(surveyId);
          if (!survey) {
            throw new ResourceNotFoundError("Survey", surveyId);
          }

          const batchSize = 3000;
          const totalResponseCount = await getResponseCountBySurveyId(surveyId);
          const filteredResponseCount = await getResponseCountBySurveyId(surveyId, filterCriteria);

          const hasFilter = totalResponseCount !== filteredResponseCount;

          const pages = Math.ceil(filteredResponseCount / batchSize);

          const responsesArray = await Promise.all(
            Array.from({ length: pages }, (_, i) => {
              return getResponses(surveyId, batchSize, i * batchSize, filterCriteria);
            })
          );
          const responses = responsesArray.flat();

          const responseIds = hasFilter ? responses.map((response) => response.id) : [];

          const displayCount = await getDisplayCountBySurveyId(surveyId, {
            createdAt: filterCriteria?.createdAt,
            ...(hasFilter && { responseIds }),
          });

          const dropOff = getSurveySummaryDropOff(survey, responses, displayCount);
          const meta = getSurveySummaryMeta(responses, displayCount);
          const questionWiseSummary = await getQuestionWiseSummary(survey, responses, dropOff);

          return { meta, dropOff, summary: questionWiseSummary };
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getSurveySummary-${surveyId}-${JSON.stringify(filterCriteria)}`],
      {
        tags: [
          surveyCache.tag.byId(surveyId),
          responseCache.tag.bySurveyId(surveyId),
          displayCache.tag.bySurveyId(surveyId),
        ],
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
  (environmentId: string, limit?: number, offset?: number): Promise<TResponse[]> =>
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
        data,
        ttc,
        language,
        variables,
      },
      select: responseSelection,
    });

    const response: TResponse = {
      ...responsePrisma,
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    responseCache.revalidate({
      id: response.id,
      personId: response.person?.id,
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
      console.error(`Failed to delete file ${fileUrl}:`, error);
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
          tags: responsePrisma.tags.map((tag) => tag.tag),
        },
        survey
      );
    }

    responseCache.revalidate({
      environmentId: survey?.environmentId,
      id: response.id,
      personId: response.person?.id,
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
  (surveyId: string, filterCriteria?: TResponseFilterCriteria): Promise<number> =>
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

export const getIfResponseWithSurveyIdAndEmailExist = reactCache(
  (surveyId: string, email: string): Promise<boolean> =>
    cache(
      async () => {
        validateInputs([surveyId, ZId], [email, ZString]);

        try {
          const response = await prisma.response.findFirst({
            where: {
              surveyId,
              data: {
                path: ["verifiedEmail"],
                equals: email,
              },
            },
            select: { id: true },
          });

          return !!response;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getIfResponseWithSurveyIdAndEmailExist-${surveyId}-${email}`],
      {
        tags: [responseCache.tag.bySurveyId(surveyId)],
      }
    )()
);

export const generateInsightsForSurveyResponses = async (surveyData: {
  id: string;
  environmentId: string;
  questions: TSurveyQuestions;
}): Promise<void> => {
  const { id: surveyId, environmentId, questions } = surveyData;

  validateInputs([surveyId, ZId], [environmentId, ZId], [questions, ZSurveyQuestions]);
  try {
    const openTextQuestionsWithInsights = questions.filter(
      (question) => question.type === TSurveyQuestionTypeEnum.OpenText && question.insightsEnabled
    );

    const openTextQuestionIds = openTextQuestionsWithInsights.map((question) => question.id);

    if (openTextQuestionIds.length === 0) {
      return;
    }

    // Fetching responses
    const batchSize = 3000;
    const totalResponseCount = await getResponseCountBySurveyId(surveyId);
    const pages = Math.ceil(totalResponseCount / batchSize);

    for (let i = 0; i < pages; i++) {
      const responses = await prisma.response.findMany({
        where: {
          surveyId,
          documents: {
            none: {},
          },
        },
        select: {
          id: true,
          data: true,
        },
        take: batchSize,
        skip: i * batchSize,
      });

      for (let response of responses) {
        const hasOpenTextResponse = doesThisResponseHasAnyOpenTextAnswer(openTextQuestionIds, response.data);

        if (!hasOpenTextResponse) {
          continue;
        }

        // Check if a document already exists for the response
        const documentExists = await doesDocumentExistForResponseId(response.id);
        if (!documentExists) {
          // Iterate over each open text question with insights enabled
          for (let question of openTextQuestionsWithInsights) {
            // Get the response text for the current question
            const responseText = response.data[question.id] as string;
            if (!responseText) {
              // Skip if there is no response text for the question
              continue;
            }

            const text = getPromptText(question.headline.default, responseText);

            await createDocument({
              environmentId,
              surveyId,
              responseId: response.id,
              questionId: question.id,
              text,
            });
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
