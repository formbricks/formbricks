import "server-only";

import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@formbricks/database";
import { ZOptionalNumber } from "@formbricks/types/common";
import {
  TDisplay,
  TDisplayCreateInput,
  TDisplayFilters,
  TDisplayLegacyCreateInput,
  TDisplayLegacyUpdateInput,
  TDisplayUpdateInput,
  ZDisplay,
  ZDisplayCreateInput,
  ZDisplayLegacyCreateInput,
  ZDisplayLegacyUpdateInput,
  ZDisplayUpdateInput,
} from "@formbricks/types/displays";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TPerson } from "@formbricks/types/people";

import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { createPerson, getPersonByUserId } from "../person/service";
import { formatDateFields } from "../utils/datetime";
import { validateInputs } from "../utils/validate";
import { displayCache } from "./cache";

export const selectDisplay = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  responseId: true,
  personId: true,
  status: true,
};

export const getDisplay = async (displayId: string): Promise<TDisplay | null> => {
  const display = await unstable_cache(
    async () => {
      validateInputs([displayId, ZId]);

      try {
        const display = await prisma.display.findUnique({
          where: {
            id: displayId,
          },
          select: selectDisplay,
        });

        return display;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getDisplay-${displayId}`],
    {
      tags: [displayCache.tag.byId(displayId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
  return display ? formatDateFields(display, ZDisplay) : null;
};

export const updateDisplay = async (
  displayId: string,
  displayInput: TDisplayUpdateInput
): Promise<TDisplay> => {
  validateInputs([displayInput, ZDisplayUpdateInput.partial()]);

  let person: TPerson | null = null;
  if (displayInput.userId) {
    person = await getPersonByUserId(displayInput.environmentId, displayInput.userId);
    if (!person) {
      throw new ResourceNotFoundError("Person", displayInput.userId);
    }
  }

  try {
    const data = {
      ...(person?.id && {
        person: {
          connect: {
            id: person.id,
          },
        },
      }),
      ...(displayInput.responseId && {
        responseId: displayInput.responseId,
      }),
    };
    const display = await prisma.display.update({
      where: {
        id: displayId,
      },
      data,
      select: selectDisplay,
    });

    displayCache.revalidate({
      id: display.id,
      surveyId: display.surveyId,
    });

    return display;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const updateDisplayLegacy = async (
  displayId: string,
  displayInput: TDisplayLegacyUpdateInput
): Promise<TDisplay> => {
  validateInputs([displayInput, ZDisplayLegacyUpdateInput]);
  try {
    const data = {
      ...(displayInput.personId && {
        person: {
          connect: {
            id: displayInput.personId,
          },
        },
      }),
      ...(displayInput.responseId && {
        responseId: displayInput.responseId,
      }),
    };
    const display = await prisma.display.update({
      where: {
        id: displayId,
      },
      data,
      select: selectDisplay,
    });
    displayCache.revalidate({
      id: display.id,
      surveyId: display.surveyId,
    });

    return display;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const createDisplay = async (displayInput: TDisplayCreateInput): Promise<TDisplay> => {
  validateInputs([displayInput, ZDisplayCreateInput]);

  const { environmentId, userId, surveyId } = displayInput;
  try {
    let person;
    if (userId) {
      person = await getPersonByUserId(environmentId, userId);
      if (!person) {
        person = await createPerson(environmentId, userId);
      }
    }
    const display = await prisma.display.create({
      data: {
        survey: {
          connect: {
            id: surveyId,
          },
        },

        ...(person && {
          person: {
            connect: {
              id: person.id,
            },
          },
        }),
      },
      select: selectDisplay,
    });
    displayCache.revalidate({
      id: display.id,
      personId: display.personId,
      surveyId: display.surveyId,
    });
    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const createDisplayLegacy = async (displayInput: TDisplayLegacyCreateInput): Promise<TDisplay> => {
  validateInputs([displayInput, ZDisplayLegacyCreateInput]);
  try {
    const display = await prisma.display.create({
      data: {
        survey: {
          connect: {
            id: displayInput.surveyId,
          },
        },

        ...(displayInput.personId && {
          person: {
            connect: {
              id: displayInput.personId,
            },
          },
        }),
      },
      select: selectDisplay,
    });

    displayCache.revalidate({
      id: display.id,
      personId: display.personId,
      surveyId: display.surveyId,
    });

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const markDisplayRespondedLegacy = async (displayId: string): Promise<TDisplay> => {
  validateInputs([displayId, ZId]);

  try {
    if (!displayId) throw new Error("Display ID is required");

    const display = await prisma.display.update({
      where: {
        id: displayId,
      },
      data: {
        status: "responded",
      },
      select: selectDisplay,
    });

    if (!display) {
      throw new ResourceNotFoundError("Display", displayId);
    }

    displayCache.revalidate({
      id: display.id,
      personId: display.personId,
      surveyId: display.surveyId,
    });

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getDisplaysByPersonId = async (personId: string, page?: number): Promise<TDisplay[]> => {
  const displays = await unstable_cache(
    async () => {
      validateInputs([personId, ZId], [page, ZOptionalNumber]);

      try {
        const displays = await prisma.display.findMany({
          where: {
            personId: personId,
          },
          select: selectDisplay,
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          orderBy: {
            createdAt: "desc",
          },
        });

        return displays;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getDisplaysByPersonId-${personId}-${page}`],
    {
      tags: [displayCache.tag.byPersonId(personId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
  return displays.map((display) => formatDateFields(display, ZDisplay));
};

export const deleteDisplayByResponseId = async (
  responseId: string,
  surveyId: string
): Promise<TDisplay | null> => {
  validateInputs([responseId, ZId], [surveyId, ZId]);

  try {
    const display = await prisma.display.delete({
      where: {
        responseId,
      },
      select: selectDisplay,
    });

    displayCache.revalidate({
      id: display.id,
      personId: display.personId,
      surveyId,
    });
    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getDisplayCountBySurveyId = async (
  surveyId: string,
  filters?: TDisplayFilters
): Promise<number> =>
  unstable_cache(
    async () => {
      validateInputs([surveyId, ZId]);

      try {
        const displayCount = await prisma.display.count({
          where: {
            surveyId: surveyId,
            ...(filters &&
              filters.createdAt && {
                createdAt: {
                  gte: filters.createdAt.min,
                  lte: filters.createdAt.max,
                },
              }),
          },
        });
        return displayCount;
      } catch (error) {
        throw error;
      }
    },
    [`getDisplayCountBySurveyId-${surveyId}`],
    {
      tags: [displayCache.tag.bySurveyId(surveyId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
