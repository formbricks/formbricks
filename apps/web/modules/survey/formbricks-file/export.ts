import "server-only";
import { prisma } from "@formbricks/database";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TV3SurveyResourceVisibility } from "@/app/api/v3/surveys/serializers";
import packageJson from "@/package.json";
import type { TFormbricksFileAttributeKey } from "./envelope";
import { type TFormbricksFile, getFormbricksFileAttributeKeys, writeFormbricksFile } from "./write";

/** The definitions of the attribute keys a survey's targeting names, in one query. */
const getAttributeKeyDefinitions = async (survey: TSurvey): Promise<TFormbricksFileAttributeKey[]> => {
  const keys = getFormbricksFileAttributeKeys(survey);
  if (keys.length === 0) return [];

  return await prisma.contactAttributeKey.findMany({
    where: { workspaceId: survey.workspaceId, key: { in: keys } },
    select: { key: true, name: true, description: true, dataType: true },
    orderBy: { key: "asc" },
  });
};

/**
 * A survey the caller may read, as a Formbricks file in the current format: its references looked up
 * in the survey's own workspace, then written by {@link writeFormbricksFile}.
 */
export const exportFormbricksFile = async ({
  survey,
  visibility,
  now = new Date(),
}: {
  survey: TSurvey;
  visibility: TV3SurveyResourceVisibility;
  now?: Date;
}): Promise<TFormbricksFile> =>
  writeFormbricksFile({
    survey,
    visibility,
    attributeKeys: await getAttributeKeyDefinitions(survey),
    appVersion: packageJson.version,
    exportedAt: now,
  });
