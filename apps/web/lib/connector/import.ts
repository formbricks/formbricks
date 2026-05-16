import "server-only";
import { TConnectorFormbricksMapping, TConnectorWithMappings } from "@formbricks/types/connector";
import { InvalidInputError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createFeedbackRecordsBatch } from "@/modules/hub";
import { getResponses } from "../response/service";
import { transformResponseToFeedbackRecords } from "./transform";

const IMPORT_BATCH_SIZE = 50;

export type TImportResult = { successes: number; failures: number; skipped: number };

const processBatch = async (
  responses: Awaited<ReturnType<typeof getResponses>>,
  survey: TSurvey,
  mappings: TConnectorFormbricksMapping[],
  tenantId: string
): Promise<TImportResult> => {
  let successes = 0;
  let failures = 0;
  let duplicates = 0;
  const expectedRecords = responses.length * mappings.length;

  const allRecords = responses.flatMap((response) =>
    transformResponseToFeedbackRecords(response, survey, mappings, tenantId)
  );

  if (allRecords.length > 0) {
    const { results } = await createFeedbackRecordsBatch(allRecords);
    successes = results.filter((r) => r.data !== null).length;
    duplicates = results.filter((r) => r.error?.status === 409).length;
    failures = results.filter((r) => r.error !== null && r.error.status !== 409).length;
  }

  const unmappedSkipped = expectedRecords - allRecords.length;
  return { successes, failures, skipped: unmappedSkipped + duplicates };
};

export const importHistoricalResponses = async (
  connector: TConnectorWithMappings,
  survey: TSurvey
): Promise<TImportResult> => {
  if (connector.type !== "formbricks_survey") {
    throw new InvalidInputError("Historical import is only supported for Formbricks connectors");
  }

  let successes = 0;
  let failures = 0;
  let skipped = 0;
  let offset = 0;

  while (true) {
    const responses = await getResponses(survey.id, IMPORT_BATCH_SIZE, offset);
    if (responses.length === 0) break;

    const batch = await processBatch(
      responses,
      survey,
      connector.formbricksMappings,
      connector.feedbackDirectoryId
    );
    successes += batch.successes;
    failures += batch.failures;
    skipped += batch.skipped;

    if (responses.length < IMPORT_BATCH_SIZE) break;
    offset += IMPORT_BATCH_SIZE;
  }

  return { successes, failures, skipped };
};
