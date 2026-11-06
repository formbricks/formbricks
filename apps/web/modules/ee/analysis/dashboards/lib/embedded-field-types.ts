import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { toEmbeddedDataRecordKey } from "@/lib/feedback-source/response-metadata";
import { getEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-member-name";

/**
 * Which embedded-data keys are numbers on a dashboard. Cube compiles every key as text, so on its own a
 * key's "> 10" would compare text. Formbricks declares a type on each Embedded Data field
 * (`EmbeddedData.dataType`), and a survey response publishes a field's value under the field's name
 * (`toEmbeddedDataRecordKey`) — as a JSON number when it is a number field. A key is a number on a
 * dashboard when every Embedded Data field it is published from, among the surveys mapped into the
 * dashboard's charts' Feedback Datasets in its workspace, is a number field. A key no field publishes
 * (imported, sent through the API, from a survey of another workspace) or that two fields of different
 * types publish stays text, as before.
 */

export type TEmbeddedFieldType = "string" | "number";

/**
 * Most Embedded Data fields read for one dashboard. Far above what the surveys of one workspace declare;
 * past it every key stays text rather than being typed from part of its definitions.
 */
export const MAX_EMBEDDED_DATA_DEFINITIONS = 5000;

type TEmbeddedDataDefinition = { name: string; dataType: string };

/**
 * The members (`FeedbackRecords.ed_*`) of the keys every one of whose definitions is a number field. A key
 * with one definition of another type, in any survey, is not one.
 */
export const resolveNumericEmbeddedFields = (
  definitions: readonly TEmbeddedDataDefinition[]
): Set<string> => {
  const isNumber = new Map<string, boolean>();
  for (const { name, dataType } of definitions) {
    const key = toEmbeddedDataRecordKey(name);
    if (!key) continue;
    const member = getEmbeddedMemberName(key);
    isNumber.set(member, (isNumber.get(member) ?? true) && dataType === "number");
  }
  return new Set([...isNumber].flatMap(([member, number]) => (number ? [member] : [])));
};

/**
 * The numeric keys of a dashboard whose charts read `datasetIds`, as members, from the Embedded Data fields
 * of the workspace's surveys that a Feedback Source of the workspace maps into one of those datasets. One
 * query; nothing outside `workspaceId` is read. Past `MAX_EMBEDDED_DATA_DEFINITIONS` no key is a number.
 */
export const getNumericEmbeddedFields = async (
  workspaceId: string,
  datasetIds: readonly string[]
): Promise<Set<string>> => {
  if (datasetIds.length === 0) return new Set();
  const definitions = await prisma.embeddedData.findMany({
    where: {
      workspaceId,
      surveyLinks: {
        some: {
          workspaceId,
          survey: {
            feedbackSourceMappings: {
              some: {
                workspaceId,
                feedbackSource: { workspaceId, feedbackDirectoryId: { in: [...datasetIds] } },
              },
            },
          },
        },
      },
    },
    select: { name: true, dataType: true },
    take: MAX_EMBEDDED_DATA_DEFINITIONS + 1,
  });
  if (definitions.length > MAX_EMBEDDED_DATA_DEFINITIONS) {
    logger.warn(
      { workspaceId },
      "Too many Embedded Data fields to type a dashboard's keys; all read as text"
    );
    return new Set();
  }
  return resolveNumericEmbeddedFields(definitions);
};
