import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { CANONICAL_LANGUAGE_CODES, normalizeLanguageCode } from "@formbricks/i18n-utils";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import {
  TLanguage,
  TLanguageInput,
  TLanguageUpdate,
  ZLanguageInput,
  ZLanguageUpdate,
} from "@formbricks/types/workspace";
import { validateInputs } from "../utils/validate";
import { getWorkspace } from "../workspace/service";

const languageSelect = {
  id: true,
  code: true,
  alias: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
};

export const getLanguage = async (languageId: string): Promise<TLanguage & { workspaceId: string }> => {
  try {
    validateInputs([languageId, ZId]);

    const language = await prisma.language.findFirst({
      where: { id: languageId },
      select: { ...languageSelect, workspaceId: true },
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
  workspaceId: string,
  languageInput: TLanguageInput
): Promise<TLanguage> => {
  try {
    validateInputs([workspaceId, ZId], [languageInput, ZLanguageInput]);
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) throw new ResourceNotFoundError("Workspace not found", workspaceId);
    if (!languageInput.code) {
      throw new ValidationError("Language code is required");
    }

    // Standardize on a canonical BCP-47 tag (ENG-1067) and only allow codes from the curated catalog.
    // Normalizing rejects malformed/unparseable codes; the catalog check additionally rejects valid-but-
    // uncurated CLDR fallbacks (e.g. "nso" -> "nso-ZA"), so persisted rows can't drift from the codes the
    // app actually supports — regardless of the caller.
    const canonicalCode = normalizeLanguageCode(languageInput.code);
    if (!canonicalCode) {
      throw new ValidationError(`Invalid language code: '${languageInput.code}'`);
    }
    if (!CANONICAL_LANGUAGE_CODES.includes(canonicalCode)) {
      throw new ValidationError(`Unsupported language code: '${languageInput.code}'`);
    }

    const language = await prisma.language.create({
      data: {
        ...languageInput,
        code: canonicalCode,
        workspace: {
          connect: { id: workspaceId },
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

export const deleteLanguage = async (languageId: string, workspaceId: string): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId], [workspaceId, ZId]);
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) throw new ResourceNotFoundError("Workspace not found", workspaceId);
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
  workspaceId: string,
  languageId: string,
  languageInput: TLanguageUpdate
): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId], [languageInput, ZLanguageUpdate], [workspaceId, ZId]);
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) throw new ResourceNotFoundError("Workspace not found", workspaceId);
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
