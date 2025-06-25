import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import {
  TLanguage,
  TLanguageInput,
  TLanguageUpdate,
  ZLanguageInput,
  ZLanguageUpdate,
} from "@formbricks/types/project";
import { getProject } from "../project/service";
import { validateInputs } from "../utils/validate";

const languageSelect = {
  id: true,
  code: true,
  alias: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
};

export const getLanguage = async (languageId: string): Promise<TLanguage & { projectId: string }> => {
  try {
    validateInputs([languageId, ZId]);

    const language = await prisma.language.findFirst({
      where: { id: languageId },
      select: { ...languageSelect, projectId: true },
    });

    if (!language) {
      throw new ResourceNotFoundError("Language", languageId);
    }

    return language;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error getting language");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const createLanguage = async (
  projectId: string,
  languageInput: TLanguageInput
): Promise<TLanguage> => {
  try {
    validateInputs([projectId, ZId], [languageInput, ZLanguageInput]);
    const project = await getProject(projectId);
    if (!project) throw new ResourceNotFoundError("Project not found", projectId);
    if (!languageInput.code) {
      throw new ValidationError("Language code is required");
    }

    const language = await prisma.language.create({
      data: {
        ...languageInput,
        project: {
          connect: { id: projectId },
        },
      },
      select: languageSelect,
    });

    return language;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error creating language");
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
      logger.error(error, "Error getting surveys using given language");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

export const deleteLanguage = async (languageId: string, projectId: string): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId], [projectId, ZId]);
    const project = await getProject(projectId);
    if (!project) throw new ResourceNotFoundError("Project not found", projectId);
    const prismaLanguage = await prisma.language.delete({
      where: { id: languageId },
      select: { ...languageSelect, surveyLanguages: { select: { surveyId: true } } },
    });

    // delete unused surveyLanguages
    const language = { ...prismaLanguage, surveyLanguages: undefined };

    return language;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error deleting language");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateLanguage = async (
  projectId: string,
  languageId: string,
  languageInput: TLanguageUpdate
): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId], [languageInput, ZLanguageUpdate], [projectId, ZId]);
    const project = await getProject(projectId);
    if (!project) throw new ResourceNotFoundError("Project not found", projectId);
    const prismaLanguage = await prisma.language.update({
      where: { id: languageId },
      data: { ...languageInput, updatedAt: new Date() },
      select: { ...languageSelect, surveyLanguages: { select: { surveyId: true } } },
    });

    // delete unused surveyLanguages
    const language = { ...prismaLanguage, surveyLanguages: undefined };

    return language;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error updating language");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
