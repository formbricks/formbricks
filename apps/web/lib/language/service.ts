import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { CANONICAL_LANGUAGE_CODES, normalizeLanguageCode } from "@formbricks/i18n-utils";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import {
  DatabaseError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import {
  TLanguage,
  TLanguageInput,
  TLanguageUpdate,
  ZLanguageInput,
  ZLanguageUpdate,
} from "@formbricks/types/workspace";
import { isWorkspaceDefaultSurveyLanguage } from "../i18n/default-survey-language";
import { andVisibleSurveys } from "../survey/visibility/predicate";
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

/**
 * The names of the surveys using a language, limited to the ones `visibleSurveyWhere` admits (the
 * caller's visibility predicate, ENG-3282): a restricted survey's name and existence are its owner's
 * and the administrators'. `{}` while visibility is not enforced.
 */
export const getSurveysUsingGivenLanguage = reactCache(
  async (languageId: string, visibleSurveyWhere: Prisma.SurveyWhereInput = {}): Promise<string[]> => {
    try {
      const visible = andVisibleSurveys(visibleSurveyWhere);
      // Check if the language is used in any survey
      const surveys = await prisma.surveyLanguage.findMany({
        where: {
          languageId: languageId,
          ...(Object.keys(visible).length > 0 ? { survey: visible } : {}),
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
  }
);

/** How many in-use survey names a refused delete lists before it summarises the rest. */
const LANGUAGE_IN_USE_NAMED_SURVEY_LIMIT = 10;

const LANGUAGE_IN_USE_REMEDY = "Remove the language from those surveys before deleting it.";

const pluralizeSurveys = (count: number): string => (count === 1 ? "1 survey" : `${count} surveys`);

/**
 * The refusal for a language some surveys still use. It names only surveys the caller may see (ENG-3282):
 * the rest are a bare count, so a restricted survey's name never reaches someone outside it.
 */
export const describeLanguageInUse = ({
  hiddenCount,
  visibleCount,
  visibleNames,
}: Readonly<{ hiddenCount: number; visibleCount: number; visibleNames: ReadonlyArray<string> }>): string => {
  const parts: string[] = [];
  if (visibleNames.length > 0) {
    const unnamed = visibleCount - visibleNames.length;
    parts.push(
      visibleNames.join(", ") +
        (unnamed > 0 ? ` and ${unnamed} more ${unnamed === 1 ? "survey" : "surveys"}` : "")
    );
  }
  if (hiddenCount > 0) parts.push(`${pluralizeSurveys(hiddenCount)} you can't see`);
  return `This language is still used by ${parts.join(" and ")}. ${LANGUAGE_IN_USE_REMEDY}`;
};

/**
 * Refuses to delete a language any survey uses: `SurveyLanguage` cascades, so the delete would silently
 * strip it from every survey — including restricted ones the caller cannot see, and so cannot have been
 * warned about. Counts every survey, visible or not; names only the visible ones.
 */
const assertLanguageNotInUse = async (
  languageId: string,
  visibleSurveyWhere: Prisma.SurveyWhereInput
): Promise<void> => {
  const visible = andVisibleSurveys(visibleSurveyWhere);
  const visibleWhere = {
    languageId,
    ...(Object.keys(visible).length > 0 ? { survey: visible } : {}),
  };

  const [totalCount, visibleCount, visibleRows] = await Promise.all([
    prisma.surveyLanguage.count({ where: { languageId } }),
    prisma.surveyLanguage.count({ where: visibleWhere }),
    prisma.surveyLanguage.findMany({
      where: visibleWhere,
      select: { survey: { select: { name: true } } },
      orderBy: { survey: { name: "asc" } },
      take: LANGUAGE_IN_USE_NAMED_SURVEY_LIMIT,
    }),
  ]);
  if (totalCount === 0) return;

  throw new OperationNotAllowedError(
    describeLanguageInUse({
      hiddenCount: Math.max(totalCount - visibleCount, 0),
      visibleCount,
      visibleNames: visibleRows.map((row) => row.survey.name),
    })
  );
};

/**
 * @param visibleSurveyWhere the caller's survey visibility clause (`getUserVisibleSurveyWhere`), used only
 *   to decide which in-use surveys a refusal may name. Required so no caller can leak a restricted
 *   survey's name through the error.
 */
export const deleteLanguage = async (
  languageId: string,
  workspaceId: string,
  visibleSurveyWhere: Prisma.SurveyWhereInput
): Promise<TLanguage> => {
  try {
    validateInputs([languageId, ZId], [workspaceId, ZId]);
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) throw new ResourceNotFoundError("Workspace not found", workspaceId);

    // The language has to belong to the workspace the caller was authorized against, or a caller with
    // `workspace.manage` on their own workspace could delete another tenant's language by id.
    const languageToDelete = workspace.languages.find(
      (workspaceLanguage) => workspaceLanguage.id === languageId
    );
    if (!languageToDelete) {
      throw new ResourceNotFoundError("Language", languageId);
    }

    // Removing the language the workspace default survey language points at would leave the setting
    // naming a language the workspace no longer has, so it is blocked until the default is changed.
    if (isWorkspaceDefaultSurveyLanguage(languageToDelete.code, workspace.config.defaultSurveyLanguage)) {
      throw new OperationNotAllowedError(
        "This language is the workspace's default survey language and cannot be removed"
      );
    }

    await assertLanguageNotInUse(languageId, visibleSurveyWhere);

    const prismaLanguage = await prisma.language.delete({
      // Scoped to the workspace as well as the id, and to a language no survey uses: the checks above
      // read a snapshot, this is what the database enforces at write time.
      where: { id: languageId, workspaceId, surveyLanguages: { none: {} } },
      select: { ...languageSelect, surveyLanguages: { select: { surveyId: true } } },
    });

    // delete unused surveyLanguages
    const language = { ...prismaLanguage, surveyLanguages: undefined };

    return language;
  } catch (error) {
    // The write-time scope matched nothing: a survey started using the language after the check above.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new OperationNotAllowedError(
        "This language could not be deleted: a survey may have started using it. Reload and try again."
      );
    }
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
