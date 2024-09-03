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
import { getProduct } from "../product/service";
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
  languageInput: TLanguageInput
): Promise<TLanguage> => {
  try {
    validateInputs([productId, ZId], [languageInput, ZLanguageInput]);
    const product = await getProduct(productId);
    if (!product) throw new ResourceNotFoundError("Product not found", productId);
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

    product.environments.forEach((environment) => {
      productCache.revalidate({
        environmentId: environment.id,
      });
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

export const deleteLanguage = async (languageId: string, productId: string): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId], [productId, ZId]);
    const product = await getProduct(productId);
    if (!product) throw new ResourceNotFoundError("Product not found", productId);
    const prismaLanguage = await prisma.language.delete({
      where: { id: languageId },
      select: { ...languageSelect, surveyLanguages: { select: { surveyId: true } } },
    });

    product.environments.forEach((environment) => {
      productCache.revalidate({
        id: prismaLanguage.productId,
        environmentId: environment.id,
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
  productId: string,
  languageId: string,
  languageInput: TLanguageUpdate
): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId], [languageInput, ZLanguageUpdate], [productId, ZId]);
    const product = await getProduct(productId);
    if (!product) throw new ResourceNotFoundError("Product not found", productId);
    const prismaLanguage = await prisma.language.update({
      where: { id: languageId },
      data: { ...languageInput, updatedAt: new Date() },
      select: { ...languageSelect, surveyLanguages: { select: { surveyId: true } } },
    });

    product.environments.forEach((environment) => {
      productCache.revalidate({
        id: prismaLanguage.productId,
        environmentId: environment.id,
      });
      surveyCache.revalidate({
        environmentId: environment.id,
      });
    });

    // revalidate cache of all connected surveys
    prismaLanguage.surveyLanguages.forEach((surveyLanguage) => {
      surveyCache.revalidate({
        id: surveyLanguage.surveyId,
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
