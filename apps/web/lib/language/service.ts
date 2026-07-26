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

    // Clear the workspace default when the deleted language was it, so a dangling code can't linger and
    // silently apply to new surveys as an (unlisted) default.
    if (
      workspace.defaultLanguageCode &&
      (normalizeLanguageCode(prismaLanguage.code) ?? prismaLanguage.code) ===
        (normalizeLanguageCode(workspace.defaultLanguageCode) ?? workspace.defaultLanguageCode)
    ) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { defaultLanguageCode: null },
      });
    }

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
    // Only the alias is mutable on update — the `code` is immutable, so `Language.code` stays canonical
    // regardless of caller (createLanguage enforces the canonical catalog; a code change means delete +
    // create). Write `alias` explicitly rather than spreading `languageInput`: a caller can pass a `code`
    // in the runtime object even though the declared type is alias-only, and spreading it would persist an
    // arbitrary, non-canonical code — the exact hole the create-side hardening closed.
    const prismaLanguage = await prisma.language.update({
      where: { id: languageId },
      data: { alias: languageInput.alias, updatedAt: new Date() },
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

/**
 * Set (or clear, with `null`) the workspace's default survey language. The code must match one of the
 * workspace's configured languages — comparison is on the canonical BCP-47 tag so a legacy-stored code
 * (e.g. `de`) still matches its canonical form (`de-DE`). The stored value is always canonical.
 */
export const setWorkspaceDefaultLanguage = async (
  workspaceId: string,
  languageCode: string | null
): Promise<string | null> => {
  try {
    validateInputs([workspaceId, ZId]);
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) throw new ResourceNotFoundError("Workspace not found", workspaceId);

    let normalizedCode: string | null = null;
    if (languageCode !== null) {
      normalizedCode = normalizeLanguageCode(languageCode);
      if (!normalizedCode) {
        throw new ValidationError(`Invalid language code: '${languageCode}'`);
      }
      const isConfigured = workspace.languages.some(
        (language) => (normalizeLanguageCode(language.code) ?? language.code) === normalizedCode
      );
      if (!isConfigured) {
        throw new ValidationError(`Language '${languageCode}' is not configured for this workspace`);
      }
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { defaultLanguageCode: normalizedCode },
    });

    // Return the canonical code that was persisted so callers can report the new value without re-reading
    // through the request-cached `getWorkspace` (which would still hold the pre-update snapshot).
    return normalizedCode;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error setting workspace default language");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
