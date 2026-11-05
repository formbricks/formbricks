import "server-only";
import { prisma } from "@formbricks/database";
import { getUserLocaleOrDefault } from "@/lib/user/locale";
import { cutText } from "@/lib/utils/cut-text";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import { getTranslate } from "@/lingodotdev/server";
import { SURVEY_IMPORT_MAX_NAME_CHARS, SURVEY_IMPORT_MAX_TAKEN_NAMES } from "../limits";
import { type TTranslate, getImportedName, importedNamePrefix, stripImportedSuffix } from "./imported-name";

/**
 * Naming a survey an import creates (ENG-6816, ENG-6850), for every lane: "<name> (imported)", or
 * "(imported N)" with the lowest N no survey in the workspace has, in the importing user's language.
 */

export type TImporterTranslate = Awaited<ReturnType<typeof getTranslate>>;

/**
 * The importing user's translations, for the "(imported)" suffix: read by the user's id rather than the
 * request, so the import runs the same wherever it is called from.
 */
export const getImporterTranslate = async (userId: string | null): Promise<TImporterTranslate> =>
  getTranslate(await getUserLocaleOrDefault(userId));

/**
 * The name without its "(imported N)", cut to `SURVEY_IMPORT_MAX_NAME_CHARS` (200) before the suffix is
 * added again, whatever lane it came from; never splitting a surrogate pair.
 */
export const capImportedSurveyName = (name: string, t: TTranslate): string => {
  const base = stripImportedSuffix(name, t);
  return cutText(base, SURVEY_IMPORT_MAX_NAME_CHARS).trimEnd();
};

/**
 * "<name> (imported)", or "(imported N)" with the lowest N no survey in the workspace has; the name cut
 * to 200 characters first.
 */
export const getImportedSurveyName = async (
  workspaceId: string,
  sourceName: string,
  t: TTranslate
): Promise<string> => {
  const name = capImportedSurveyName(sourceName, t);
  const taken = await prisma.survey.findMany({
    where: { workspaceId, name: { startsWith: escapeLikePattern(importedNamePrefix(name, t)) } },
    select: { name: true },
    take: SURVEY_IMPORT_MAX_TAKEN_NAMES,
  });
  const takenNames = new Set(taken.map((survey) => survey.name));
  return getImportedName(name, (candidate) => takenNames.has(candidate), t);
};
