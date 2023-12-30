import { Prisma } from "@prisma/client";
import { customAlphabet } from "nanoid";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

import { validateInputs } from "../utils/validate";

// Create the short url and return it
export const createResultShareKey = async (surveyId: string): Promise<string> => {
  validateInputs([surveyId, ZId]);

  try {
    const survey = await prisma.survey.findFirst({
      where: {
        id: surveyId,
      },
    });

    if (!survey) {
      throw new ResourceNotFoundError("survey", surveyId);
    }

    if (survey.resultShareKey) {
      return survey.resultShareKey;
    }

    const id = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 10)();

    await prisma.survey.update({
      where: {
        id: surveyId,
      },
      data: {
        resultShareKey: id,
      },
    });

    return id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResultShareUrlsBySurveyId = async (surveyId: string): Promise<string | null> => {
  validateInputs([surveyId, ZId]);
  try {
    const survey = await prisma.survey.findFirst({
      where: {
        id: surveyId,
      },
    });

    if (!survey) {
      throw new ResourceNotFoundError("survey", surveyId);
    }

    return survey.resultShareKey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponseKeySurvey = async (key: string): Promise<string | null> => {
  try {
    const survey = await prisma.survey.findFirst({
      where: {
        resultShareKey: key,
      },
    });

    if (!survey) {
      throw new ResourceNotFoundError("survey", key);
    }

    return survey.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteResultShareUrlBySurveyId = async (surveyId: string): Promise<boolean> => {
  try {
    validateInputs([surveyId, ZId]);

    const survey = await prisma.survey.findFirst({
      where: {
        id: surveyId,
      },
    });

    if (!survey) {
      throw new ResourceNotFoundError("survey", surveyId);
    }

    await prisma.survey.update({
      where: {
        id: surveyId,
      },
      data: {
        resultShareKey: null,
      },
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
