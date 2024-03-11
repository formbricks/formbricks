import "server-only";

import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@formbricks/database";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TPerson } from "@formbricks/types/people";
import {
  TResponse,
  TResponseFilterCriteria,
  TResponseInput,
  TResponseLegacyInput,
  TResponseUpdateInput,
  TSurveyPersonAttributes,
  TSurveySummary,
  ZResponse,
  ZResponseFilterCriteria,
  ZResponseInput,
  ZResponseLegacyInput,
  ZResponseNote,
  ZResponseUpdateInput,
} from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";

import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL, WEBAPP_URL } from "../constants";
import { deleteDisplayByResponseId, getDisplayCountBySurveyId } from "../display/service";
import { createPerson, getPerson, getPersonByUserId, transformPrismaPerson } from "../person/service";
import {
  buildWhereClause,
  calculateTtcTotal,
  extractSurveyDetails,
  getQuestionWiseSummary,
  getResponsesFileName,
  getResponsesJson,
  getSurveySummaryDropOff,
  getSurveySummaryMeta,
} from "../response/util";
import { responseNoteCache } from "../responseNote/cache";
import { getResponseNotes } from "../responseNote/service";
import { putFile } from "../storage/service";
import { getSurvey } from "../survey/service";
import { captureTelemetry } from "../telemetry";
import { formatDateFields } from "../utils/datetime";
import { convertToCsv, convertToXlsxBuffer } from "../utils/fileConversion";
import { validateInputs } from "../utils/validate";
import { responseCache } from "./cache";

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
  personAttributes: true,
  singleUseId: true,
  person: {
    select: {
      id: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      environmentId: true,
      attributes: {
        select: {
          value: true,
          attributeClass: {
            select: {
              name: true,
            },
          },
        },
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
};

export const getResponsesByPersonId = async (
  personId: string,
  page?: number
): Promise<Array<TResponse> | null> => {
  const responses = await unstable_cache(
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
            updatedAt: "asc",
          },
        });

        if (!responsePrisma) {
          throw new ResourceNotFoundError("Response from PersonId", personId);
        }

        let responses: Array<TResponse> = [];

        await Promise.all(
          responsePrisma.map(async (response) => {
            const responseNotes = await getResponseNotes(response.id);
            responses.push({
              ...response,
              notes: responseNotes,
              person: response.person ? transformPrismaPerson(response.person) : null,
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
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return responses.map((response) => ({
    ...formatDateFields(response, ZResponse),
    notes: response.notes.map((note) => formatDateFields(note, ZResponseNote)),
  }));
};

export const getResponseBySingleUseId = async (
  surveyId: string,
  singleUseId: string
): Promise<TResponse | null> => {
  const response = await unstable_cache(
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
          person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
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
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return response
    ? {
        ...formatDateFields(response, ZResponse),
        notes: response.notes.map((note) => formatDateFields(note, ZResponseNote)),
      }
    : null;
};

export const createResponse = async (responseInput: TResponseInput): Promise<TResponse> => {
  validateInputs([responseInput, ZResponseInput]);
  captureTelemetry("response created");

  const { environmentId, userId, surveyId, finished, data, meta, singleUseId } = responseInput;

  try {
    let person: TPerson | null = null;

    if (userId) {
      person = await getPersonByUserId(environmentId, userId);
      if (!person) {
        // create person if it does not exist
        person = await createPerson(environmentId, userId);
      }
    }

    const responsePrisma = await prisma.response.create({
      data: {
        survey: {
          connect: {
            id: surveyId,
          },
        },
        finished: finished,
        data: data,
        ...(person?.id && {
          person: {
            connect: {
              id: person.id,
            },
          },
          personAttributes: person?.attributes,
        }),
        ...(meta && ({ meta } as Prisma.JsonObject)),
        singleUseId,
      },
      select: responseSelection,
    });

    const response: TResponse = {
      ...responsePrisma,
      person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    responseCache.revalidate({
      environmentId: environmentId,
      id: response.id,
      personId: response.person?.id,
      surveyId: response.surveyId,
      singleUseId: singleUseId ? singleUseId : undefined,
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

export const createResponseLegacy = async (responseInput: TResponseLegacyInput): Promise<TResponse> => {
  validateInputs([responseInput, ZResponseLegacyInput]);
  captureTelemetry("response created");

  try {
    let person: TPerson | null = null;

    if (responseInput.personId) {
      person = await getPerson(responseInput.personId);
    }
    const ttcTemp = responseInput.ttc ?? {};
    const questionId = Object.keys(ttcTemp)[0];
    const ttc =
      responseInput.finished && responseInput.ttc
        ? {
            ...ttcTemp,
            _total: ttcTemp[questionId], // Add _total property with the same value
          }
        : ttcTemp;
    const responsePrisma = await prisma.response.create({
      data: {
        survey: {
          connect: {
            id: responseInput.surveyId,
          },
        },
        finished: responseInput.finished,
        data: responseInput.data,
        ttc,
        ...(responseInput.personId && {
          person: {
            connect: {
              id: responseInput.personId,
            },
          },
          personAttributes: person?.attributes,
        }),

        ...(responseInput.meta && ({ meta: responseInput?.meta } as Prisma.JsonObject)),
        singleUseId: responseInput.singleUseId,
      },
      select: responseSelection,
    });

    const response: TResponse = {
      ...responsePrisma,
      person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
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

export const getResponse = async (responseId: string): Promise<TResponse | null> => {
  const response = await unstable_cache(
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
          person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
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
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return response
    ? ({
        ...formatDateFields(response, ZResponse),
        notes: response.notes.map((note) => formatDateFields(note, ZResponseNote)),
      } as TResponse)
    : null;
};

export const getResponsePersonAttributes = async (surveyId: string): Promise<TSurveyPersonAttributes> => {
  const responses = await unstable_cache(
    async () => {
      validateInputs([surveyId, ZId]);

      try {
        let attributes: TSurveyPersonAttributes = {};
        const responseAttributes = await prisma.response.findMany({
          where: {
            surveyId: surveyId,
          },
          select: {
            personAttributes: true,
          },
        });

        responseAttributes.forEach((response) => {
          Object.keys(response.personAttributes ?? {}).forEach((key) => {
            if (response.personAttributes && attributes[key]) {
              attributes[key].push(response.personAttributes[key].toString());
            } else if (response.personAttributes) {
              attributes[key] = [response.personAttributes[key].toString()];
            }
          });
        });

        Object.keys(attributes).forEach((key) => {
          attributes[key] = Array.from(new Set(attributes[key]));
        });

        return attributes;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getAttributesFromResponses-${surveyId}`],
    {
      tags: [responseCache.tag.bySurveyId(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return responses;
};

export const getResponses = async (
  surveyId: string,
  page?: number,
  batchSize?: number,
  filterCriteria?: TResponseFilterCriteria
): Promise<TResponse[]> => {
  const responses = await unstable_cache(
    async () => {
      validateInputs(
        [surveyId, ZId],
        [page, ZOptionalNumber],
        [batchSize, ZOptionalNumber],
        [filterCriteria, ZResponseFilterCriteria.optional()]
      );
      batchSize = batchSize ?? RESPONSES_PER_PAGE;

      try {
        const responses = await prisma.response.findMany({
          where: {
            surveyId,
            ...buildWhereClause(filterCriteria),
          },
          select: responseSelection,
          orderBy: [
            {
              createdAt: "desc",
            },
          ],
          take: page ? batchSize : undefined,
          skip: page ? batchSize * (page - 1) : undefined,
        });

        const transformedResponses: TResponse[] = await Promise.all(
          responses.map((responsePrisma) => {
            return {
              ...responsePrisma,
              person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
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
    [`getResponses-${surveyId}-${page}-${batchSize}-${JSON.stringify(filterCriteria)}`],
    {
      tags: [responseCache.tag.bySurveyId(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
  return responses.map((response) => ({
    ...formatDateFields(response, ZResponse),
    notes: response.notes.map((note) => formatDateFields(note, ZResponseNote)),
  }));
};

export const getSurveySummary = (
  surveyId: string,
  filterCriteria?: TResponseFilterCriteria
): Promise<TSurveySummary> => {
  const summary = unstable_cache(
    async () => {
      validateInputs([surveyId, ZId], [filterCriteria, ZResponseFilterCriteria.optional()]);

      const survey = await getSurvey(surveyId);

      if (!survey) {
        throw new ResourceNotFoundError("Survey", surveyId);
      }

      const batchSize = 3000;
      const responseCount = await getResponseCountBySurveyId(surveyId, filterCriteria);
      const pages = Math.ceil(responseCount / batchSize);

      const responsesArray = await Promise.all(
        Array.from({ length: pages }, (_, i) => {
          return getResponses(surveyId, i + 1, batchSize, filterCriteria);
        })
      );
      const responses = responsesArray.flat();

      const displayCount = await getDisplayCountBySurveyId(surveyId, {
        createdAt: filterCriteria?.createdAt,
      });

      const meta = getSurveySummaryMeta(responses, displayCount);
      const dropOff = getSurveySummaryDropOff(survey, responses, displayCount);
      const questionWiseSummary = getQuestionWiseSummary(survey, responses);

      return { meta, dropOff, summary: questionWiseSummary };
    },
    [`getSurveySummary-${surveyId}-${JSON.stringify(filterCriteria)}`],
    {
      tags: [responseCache.tag.bySurveyId(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return summary;
};

export const getResponseDownloadUrl = async (
  surveyId: string,
  format: "csv" | "xlsx",
  filterCriteria?: TResponseFilterCriteria
): Promise<string> => {
  try {
    validateInputs([surveyId, ZId], [format, ZString], [filterCriteria, ZResponseFilterCriteria.optional()]);
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
        return getResponses(surveyId, i + 1, batchSize, filterCriteria);
      })
    );
    const responses = responsesArray.flat();

    const { metaDataFields, questions, hiddenFields, userAttributes } = extractSurveyDetails(
      survey,
      responses
    );

    const headers = [
      "No.",
      "Response ID",
      "Timestamp",
      "Finished",
      "Survey ID",
      "User ID",
      "Notes",
      "Tags",
      ...metaDataFields,
      ...questions,
      ...hiddenFields,
      ...userAttributes,
    ];

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

export const getResponsesByEnvironmentId = async (
  environmentId: string,
  page?: number
): Promise<TResponse[]> => {
  const responses = await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

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
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        });

        const transformedResponses: TResponse[] = await Promise.all(
          responses.map(async (responsePrisma) => {
            return {
              ...responsePrisma,
              person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
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
    [`getResponsesByEnvironmentId-${environmentId}`],
    {
      tags: [responseCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return responses.map((response) => ({
    ...formatDateFields(response, ZResponse),
    notes: response.notes.map((note) => formatDateFields(note, ZResponseNote)),
  }));
};

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

    const responsePrisma = await prisma.response.update({
      where: {
        id: responseId,
      },
      data: {
        finished: responseInput.finished,
        data,
        ttc,
      },
      select: responseSelection,
    });

    const response: TResponse = {
      ...responsePrisma,
      person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
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
      person: responsePrisma.person ? transformPrismaPerson(responsePrisma.person) : null,
      tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    };

    deleteDisplayByResponseId(responseId, response.surveyId);

    const survey = await getSurvey(response.surveyId);

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

export const getResponseCountBySurveyId = async (
  surveyId: string,
  filterCriteria?: TResponseFilterCriteria
): Promise<number> =>
  unstable_cache(
    async () => {
      validateInputs([surveyId, ZId], [filterCriteria, ZResponseFilterCriteria.optional()]);

      try {
        const responseCount = await prisma.response.count({
          where: {
            surveyId: surveyId,
            ...buildWhereClause(filterCriteria),
          },
        });
        return responseCount;
      } catch (error) {
        throw error;
      }
    },
    [`getResponseCountBySurveyId-${surveyId}-${JSON.stringify(filterCriteria)}`],
    {
      tags: [responseCache.tag.bySurveyId(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
