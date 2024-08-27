import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import {
  TLanguage,
  TLanguageInput,
  TLanguageUpdate,
  ZLanguageInput,
  ZLanguageUpdate,
} from "@formbricks/types/product";
import { productCache } from "../product/cache";
import { surveyCache } from "../survey/cache";
import { validateInputs } from "../utils/validate";

const languageSelect = {
  id: true,
  code: true,
  alias: true,
  productId: true,
  createdAt: true,
  updatedAt: true,
};

export const getLanguage = async (languageId: string): Promise<TLanguage & { productId: string }> => {
  try {
    validateInputs([languageId, ZId]);

    const language = await prisma.language.findFirst({
      where: { id: languageId },
      select: { ...languageSelect, productId: true },
    });

    if (!language) {
      throw new ResourceNotFoundError("Language", languageId);
    }

    return language;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const createLanguage = async (
  productId: string,
  environmentId: string,
  languageInput: TLanguageInput
): Promise<TLanguage> => {
  try {
    validateInputs([productId, ZId], [environmentId, ZId], [languageInput, ZLanguageInput]);
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
      select: languageSelect,
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

export const getSurveysUsingGivenLanguage = reactCache(async (languageId: string): Promise<string[]> => {
  try {
    // Check if the language is used in any survey
    const surveys = await prisma.surveyLanguage.findMany({
      where: {
        languageId: languageId,
      },
      select: {
        survey: {
          select: {
            name: true,
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
});

export const deleteLanguage = async (environmentId: string, languageId: string): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId]);

    const prismaLanguage = await prisma.language.delete({
      where: { id: languageId },
      select: { ...languageSelect, surveyLanguages: { select: { surveyId: true } } },
    });

    productCache.revalidate({
      id: prismaLanguage.productId,
      environmentId,
    });

    // revalidate cache of all connected surveys
    prismaLanguage.surveyLanguages.forEach((surveyLanguage) => {
      surveyCache.revalidate({
        id: surveyLanguage.surveyId,
        environmentId,
      });
    });

    // delete unused surveyLanguages
    const language = { ...prismaLanguage, surveyLanguages: undefined };

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
  environmentId: string,
  languageId: string,
  languageInput: TLanguageUpdate
): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId], [languageInput, ZLanguageUpdate]);

    const prismaLanguage = await prisma.language.update({
      where: { id: languageId },
      data: { ...languageInput, updatedAt: new Date() },
      select: { ...languageSelect, surveyLanguages: { select: { surveyId: true } } },
    });

    productCache.revalidate({
      id: prismaLanguage.productId,
      environmentId,
    });

    // revalidate cache of all connected surveys
    prismaLanguage.surveyLanguages.forEach((surveyLanguage) => {
      surveyCache.revalidate({
        id: surveyLanguage.surveyId,
        environmentId,
      });
    });

    // delete unused surveyLanguages
    const language = { ...prismaLanguage, surveyLanguages: undefined };

    return language;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
