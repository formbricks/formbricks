import "server-only";
import type { TFeedbackSourceFieldMapping } from "@formbricks/types/feedback-source";
import { getFeedbackSourcesByFeedbackDirectoryId } from "@/lib/feedback-source/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import { assertCanWriteDirectoryRecords } from "@/modules/ee/feedback-directory/lib/access";
import { getAccessibleWorkspaceIds, getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { listFeedbackRecords } from "@/modules/hub/service";
import type { FeedbackRecordData } from "@/modules/hub/types";
import {
  type TDatasetSourceOption,
  type TFeedbackDatasetOverview,
  getFeedbackDatasetOverview,
} from "./overview";

const INITIAL_PAGE_SIZE = 50;

export interface TSurveyWorkspaceResolution {
  workspaceId: string | null;
  accessible: boolean;
}

/**
 * A CSV feedback source assigned to the dataset, projected for the "Import via …" menu. Carries its
 * own `workspaceId` because the CSV upload flow is still workspace-scoped even though the record view
 * is not.
 */
export interface TDatasetCsvSource {
  id: string;
  name: string;
  workspaceId: string;
  fieldMappings: TFeedbackSourceFieldMapping[];
}

/**
 * Everything the Feedback Records client needs to render one dataset: the first page of records and
 * its cursor, the overview-header stats, the Source-filter options, and the per-survey workspace
 * resolution map for the deep-links. Assembled on the server for the SSR default dataset and, via a
 * server action, on every client-side dataset switch so the whole view stays consistent.
 */
export interface TFeedbackDatasetView {
  records: FeedbackRecordData[];
  cursor: string | null;
  overview: TFeedbackDatasetOverview;
  sourceOptions: TDatasetSourceOption[];
  csvSources: TDatasetCsvSource[];
  surveyWorkspaceMap: Record<string, TSurveyWorkspaceResolution>;
  // Whether the viewer may create/edit/delete manual records in THIS dataset. Write access is
  // per-dataset (a member can write to one dataset but only read another), so it travels with the
  // view bundle and refreshes on every dataset switch rather than being a single page-level flag.
  canWrite: boolean;
}

const isFormbricksSurveyRecord = (record: FeedbackRecordData): boolean =>
  (record.source_type === "formbricks" || record.source_type === "formbricks_survey") && !!record.source_id;

/**
 * Boolean form of {@link assertCanWriteDirectoryRecords}: resolves the write tier for a dataset the
 * caller can already view. A thrown AuthorizationError means read-only.
 */
const resolveCanWrite = async (
  userId: string,
  organizationId: string,
  datasetId: string
): Promise<boolean> => {
  try {
    await assertCanWriteDirectoryRecords(userId, organizationId, datasetId);
    return true;
  } catch {
    return false;
  }
};

/**
 * Precomputes, for the Formbricks-survey records on a page, which workspace each survey lives in and
 * whether the viewer can reach it (decision #6). Distinct survey ids only, so a page full of one
 * survey costs a single lookup. A survey that can't be resolved (deleted, or in an unreachable
 * workspace) maps to a non-accessible entry, which the client renders as plain text.
 */
const buildSurveyWorkspaceMap = async (
  userId: string,
  organizationId: string,
  records: FeedbackRecordData[]
): Promise<Record<string, TSurveyWorkspaceResolution>> => {
  const surveyIds = Array.from(
    new Set(records.filter(isFormbricksSurveyRecord).map((record) => record.source_id as string))
  );
  if (surveyIds.length === 0) return {};

  const accessibleWorkspaceIds = new Set(await getAccessibleWorkspaceIds(userId, organizationId));

  const entries = await Promise.all(
    surveyIds.map(async (surveyId): Promise<[string, TSurveyWorkspaceResolution]> => {
      try {
        const workspaceId = await getWorkspaceIdFromSurveyId(surveyId);
        const accessible = accessibleWorkspaceIds.has(workspaceId);
        return [surveyId, { workspaceId: accessible ? workspaceId : null, accessible }];
      } catch {
        return [surveyId, { workspaceId: null, accessible: false }];
      }
    })
  );

  return Object.fromEntries(entries);
};

/**
 * The CSV "Import via …" affordance uploads into a specific workspace, so only surface CSV sources
 * in workspaces the viewer can actually write to. Owner/manager may write to any; other roles need
 * readWrite/manage on that source's workspace. Without this a member could see (and click, only to
 * get a 403) import entries for sibling workspaces they can't upload to — a dead-end action and a
 * minor cross-workspace source-name leak. The CSV import route re-checks write access server-side,
 * so this is a UX/disclosure guard, not the security boundary.
 */
const filterWritableCsvSources = async (
  userId: string,
  organizationId: string,
  csvSources: TDatasetCsvSource[]
): Promise<TDatasetCsvSource[]> => {
  if (csvSources.length === 0) return [];

  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  const { isOwner, isManager } = getAccessFlags(membership?.role);
  if (isOwner || isManager) return csvSources;

  const workspaceIds = Array.from(new Set(csvSources.map((source) => source.workspaceId)));
  const permissions = await Promise.all(
    workspaceIds.map((workspaceId) => getWorkspacePermissionByUserId(userId, workspaceId))
  );
  const writableWorkspaceIds = new Set(
    workspaceIds.filter((_, index) => permissions[index] === "readWrite" || permissions[index] === "manage")
  );
  return csvSources.filter((source) => writableWorkspaceIds.has(source.workspaceId));
};

/**
 * Fetches the full dataset view for a single tenant. Tolerates a Hub outage on the record list: the
 * records fall back to empty (the table shows its own empty state) while the overview still renders
 * "—" placeholders. Callers must have already authorized the dataset (assertCanViewDirectory).
 */
export const getFeedbackDatasetView = async (
  userId: string,
  organizationId: string,
  datasetId: string
): Promise<TFeedbackDatasetView> => {
  const recordsResult = await listFeedbackRecords({ tenant_id: datasetId, limit: INITIAL_PAGE_SIZE });
  const records = recordsResult.error ? [] : (recordsResult.data?.data ?? []);
  const cursor = recordsResult.error ? null : (recordsResult.data?.next_cursor ?? null);

  const [{ overview, sourceOptions }, surveyWorkspaceMap, feedbackSources, canWrite] = await Promise.all([
    getFeedbackDatasetOverview(datasetId, records[0] ?? null),
    buildSurveyWorkspaceMap(userId, organizationId, records),
    getFeedbackSourcesByFeedbackDirectoryId(datasetId),
    resolveCanWrite(userId, organizationId, datasetId),
  ]);

  const csvSources: TDatasetCsvSource[] = feedbackSources
    .filter((source) => source.type === "csv")
    .map((source) => ({
      id: source.id,
      name: source.name,
      workspaceId: source.workspaceId,
      fieldMappings: source.fieldMappings,
    }));
  const writableCsvSources = await filterWritableCsvSources(userId, organizationId, csvSources);

  return {
    records,
    cursor,
    overview,
    sourceOptions,
    csvSources: writableCsvSources,
    surveyWorkspaceMap,
    canWrite,
  };
};
