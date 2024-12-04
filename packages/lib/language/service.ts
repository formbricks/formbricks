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
} from "@formbricks/types/project";
import { projectCache } from "../project/cache";
import { getProject } from "../project/service";
import { surveyCache } from "../survey/cache";
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
      console.error(error);
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

    project.environments.forEach((environment) => {
      projectCache.revalidate({
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

export const deleteLanguage = async (languageId: string, projectId: string): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId], [projectId, ZId]);
    const project = await getProject(projectId);
    if (!project) throw new ResourceNotFoundError("Project not found", projectId);
    const prismaLanguage = await prisma.language.delete({
      where: { id: languageId },
      select: { ...languageSelect, surveyLanguages: { select: { surveyId: true } } },
    });

    project.environments.forEach((environment) => {
      projectCache.revalidate({
        id: prismaLanguage.projectId,
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

    project.environments.forEach((environment) => {
      projectCache.revalidate({
        id: prismaLanguage.projectId,
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
