import "server-only";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { getDatasetChartFields } from "@/modules/ee/analysis/lib/dataset-chart-fields";
import { type TDatasetChartFields, queryNamesTopicField } from "@/modules/ee/analysis/lib/field-catalog";

/**
 * The chart's Feedback Dataset as the validator judges a query against it: its embedded-data fields and,
 * when `query` holds an answer rule, its answerable questions. `undefined` without an actor to discover
 * keys as, which leaves the fields every dataset shares.
 *
 * `checkTopics` is for a query being written or previewed: when it names a topic field, the dataset's
 * current topic labels are loaded too, so the validator can require an active taxonomy and current
 * labels (ENG-6989). Reading a saved chart leaves it off.
 */
export const loadDatasetChartFields = async (
  authentication: TV3Authentication,
  access: V3WorkspaceContext,
  datasetId: string,
  query: unknown,
  { checkTopics = false }: { checkTopics?: boolean } = {}
): Promise<TDatasetChartFields | undefined> => {
  const actor = getV3AuthorizationActor(authentication);
  if (!actor) return undefined;
  return getDatasetChartFields(
    { datasetId, workspaceId: access.workspaceId, organizationId: access.organizationId, actor },
    { query, withTopics: checkTopics && queryNamesTopicField(query) }
  );
};
