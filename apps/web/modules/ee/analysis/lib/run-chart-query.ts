import "server-only";
import type { TChartQuery } from "@formbricks/types/analysis";
import { executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import type { TCubeQueryActor, TCubeQuerySource } from "@/modules/ee/analysis/api/lib/cube-config";
import {
  dropEmptyMeasureRows,
  withOptionIdFilter,
} from "@/modules/ee/analysis/charts/lib/empty-measure-rows";
import { pruneChartLabels, resolveOptionGrouping } from "@/modules/ee/analysis/charts/lib/option-grouping";
import type { TChartDataRow, TChartLabelMaps } from "@/modules/ee/analysis/types/analysis";
import { getCubeQueryMembers } from "../api/lib/cube-query";
import { isEmbeddedFieldMember } from "./embedded-data-fields";
import { getEmbeddedChartFields } from "./embedded-data-fields.server";

export type TChartQueryRun = TChartLabelMaps & {
  rows: TChartDataRow[];
  /** The query as Cube ran it, after option grouping — what a renderer has to read the rows against. */
  effectiveQuery: TChartQuery;
};

/**
 * Embedded Data members are hashes of the field name, so a renderer cannot label them on its own. The
 * lookup is the one the run already made (`getEmbeddedChartFields` is cached per request).
 */
const getEmbeddedMemberLabels = async (
  query: TChartQuery,
  workspaceId: string,
  datasetId: string
): Promise<Record<string, string> | undefined> => {
  const used = new Set(getCubeQueryMembers(query).filter(isEmbeddedFieldMember));
  if (used.size === 0) return undefined;
  const fields = await getEmbeddedChartFields(workspaceId, datasetId);
  return Object.fromEntries(
    fields.filter((field) => used.has(field.id)).map((field) => [field.id, field.name])
  );
};

/**
 * Run a chart query the way every surface renders one — the builder's preview, a dashboard widget, the
 * chart data API — so they cannot disagree on a number:
 *
 * 1. resolve option grouping, which attaches survey labels for option and matrix-row ids;
 * 2. run it in the dataset's tenant, attributed to `actor`;
 * 3. drop the groups no selected measure can answer for (ENG-3150);
 * 4. prune the label maps to what the rows use, and name the Embedded Data fields it used (ENG-2848).
 *
 * Authorization is the caller's: by the time this runs, the actor must already be allowed to read the
 * dataset from `workspaceId`.
 */
export const runChartQuery = async ({
  query,
  datasetId,
  workspaceId,
  organizationId,
  actor,
  source,
}: {
  query: TChartQuery;
  datasetId: string;
  workspaceId: string;
  organizationId: string;
  actor: TCubeQueryActor;
  source: TCubeQuerySource;
}): Promise<TChartQueryRun> => {
  const grouping = await resolveOptionGrouping(query, workspaceId, datasetId);
  const { rewrittenQuery } = grouping;

  const data = await executeTenantScopedQuery({
    query: withOptionIdFilter(rewrittenQuery),
    feedbackDirectoryId: datasetId,
    workspaceId,
    organizationId,
    actor,
    source,
  });

  const rows = dropEmptyMeasureRows(Array.isArray(data) ? data : [], rewrittenQuery);
  const memberLabels = await getEmbeddedMemberLabels(rewrittenQuery, workspaceId, datasetId);
  return {
    rows,
    ...pruneChartLabels(grouping, rows),
    ...(memberLabels ? { memberLabels } : {}),
    effectiveQuery: rewrittenQuery,
  };
};
