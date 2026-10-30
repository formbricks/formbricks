import "server-only";
import { prisma } from "@formbricks/database";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getImportedName, stripImportedSuffix } from "./imported-name";

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
  getTranslate((userId ? await getUserLocale(userId) : undefined) ?? DEFAULT_LOCALE);

/** "<name> (imported)", or "(imported N)" with the lowest N no survey in the workspace has. */
export const getImportedSurveyName = async (
  workspaceId: string,
  name: string,
  t: TImporterTranslate
): Promise<string> => {
  const taken = await prisma.survey.findMany({
    where: { workspaceId, name: { startsWith: stripImportedSuffix(name, t) } },
    select: { name: true },
  });
  const takenNames = new Set(taken.map((survey) => survey.name));
  return getImportedName(name, (candidate) => takenNames.has(candidate), t);
};
