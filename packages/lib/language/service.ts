import { Prisma } from "@prisma/client";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import { TLanguage, TLanguageInput, ZLanguageInput } from "@formbricks/types/product";

import { productCache } from "../product/cache";
import { validateInputs } from "../utils/validate";

export const createLanguage = async (
  productId: string,
  environmentId: string,
  languageInput: TLanguageInput
): Promise<TLanguage> => {
  try {
    validateInputs([productId, ZId], [languageInput, ZLanguageInput]);
    if (!languageInput.code) {
      throw new ValidationError("Language code is required");
    }

    const language = await prisma.language.create({
      data: {
        ...languageInput,
        product: {
          connect: { id: productId },
        },
      },
    });

    productCache.revalidate({
      id: productId,
      environmentId,
    });

    return language;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getSurveysUsingGivenLanguage = async (languageId: string): Promise<string[]> => {
  try {
    // Check if the language is used in any survey
    const surveys = await prisma.surveyLanguage.findMany({
      where: {
        languageId: languageId,
      },
      include: {
        survey: {
          select: {
            name: true, // Select only the name of the survey
          },
        },
      },
    });

    // Extracting survey names
    const surveyNames = surveys.map((s) => s.survey.name);
    return surveyNames;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteLanguage = async (
  productId: string,
  environmentId: string,
  languageId: string
): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId]);

    const language = await prisma.language.delete({
      where: { id: languageId },
    });

    productCache.revalidate({
      id: productId,
      environmentId,
    });
    return language;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateLanguage = async (
  productId: string,
  environmentId: string,
  languageId: string,
  languageInput: Partial<TLanguage>
): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId], [languageInput, ZLanguageInput]);

    const language = await prisma.language.update({
      where: { id: languageId },
      data: { ...languageInput, updatedAt: new Date() },
    });

    productCache.revalidate({
      id: productId,
      environmentId,
    });

    return language;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
