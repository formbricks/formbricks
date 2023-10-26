import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TResponseKey, ZResponseKeyId } from "@formbricks/types/responseKey";
import { Prisma } from "@prisma/client";
import { customAlphabet } from "nanoid";
import { validateInputs } from "../utils/validate";
import z from "zod";

// Create the short url and return it
export const createResponseSharingkey = async (surveyId: string): Promise<string> => {
  validateInputs([surveyId, z.string().cuid2()]);

  try {
    // Check if an entry with the provided survey id already exists.
    const existingKey = await getResponseKeyBySurveyId(surveyId);

    if (existingKey) {
      return existingKey;
    }

    // If an entry with the provided fullUrl does not exist, create a new one.
    const id = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 10)();

    const key = await prisma.responseSharingKey.create({
      data: {
        id,
        surveyId,
      },
    });
    return key.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponseKeyBySurveyId = async (surveyId: string): Promise<string | null> => {
  validateInputs([surveyId, z.string().cuid2()]);
  try {
    const key = await prisma.responseSharingKey.findFirst({
      where: {
        surveyId,
      },
    });

    if (!key) {
      return null;
    }

    return key.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getResponseKeySurvey = async (key: string): Promise<string | null> => {
  try {
    const responseKey = await prisma.responseSharingKey.findFirst({
      where: {
        id: key,
      },
    });

    if (responseKey) {
      return responseKey.surveyId;
    }

    return null; // Return null if no matching key is found
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteResponseSharingKeyBySurveyId = async (surveyId: string): Promise<boolean> => {
  try {
    validateInputs([surveyId, z.string().cuid2()]);

    const existingKey = await prisma.responseSharingKey.findFirst({
      where: {
        surveyId,
      },
    });

    if (!existingKey) {
      throw new Error("Key not found");
    }

    await prisma.responseSharingKey.delete({
      where: {
        id: existingKey.id,
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
