import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { cache } from "@/lib/cache";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { getActiveTaxonomyTree } from "@/modules/hub/service";
import type { TaxonomyNode } from "@/modules/hub/types";
import { isHubNotConfigured } from "@/modules/hub/utils";
import type { TDatasetTopics, TDatasetTopicsState } from "./field-catalog";
import { TOPIC_PATH_SEPARATOR } from "./schema-definition";

export type TDatasetTopicsScope = { datasetId: string; organizationId: string };

/** How long a dataset's labels are reused. Renames and removals made in the app clear them at once. */
const TOPIC_LABELS_TTL_MS = 60_000;

/**
 * The label the taxonomy service gives the outlier cluster's leaf; Hub refuses any other. A renamed
 * outlier leaf keeps it as its `original_label`.
 */
const OUTLIER_LEAF_LABEL = "Uncategorized Feedback";

const isVisible = (node: TaxonomyNode): boolean => !node.removed_at;

const isOutlierLeaf = (node: TaxonomyNode): boolean =>
  node.node_type === "leaf" && (node.original_label ?? node.label) === OUTLIER_LEAF_LABEL;

/**
 * Whether a branch has a visible leaf below it other than the outlier's. Charts leave outliers out, so a
 * branch the taxonomy service made only for them ("Uncategorized") never has a record to show.
 */
const hasClassifiedLeaf = (node: TaxonomyNode): boolean =>
  (node.children ?? [])
    .filter(isVisible)
    .some((child) => (child.node_type === "leaf" ? !isOutlierLeaf(child) : hasClassifiedLeaf(child)));

const uniqueSorted = (labels: string[]): string[] => [...new Set(labels)].sort((a, b) => a.localeCompare(b));

/**
 * The labels of an active tree's level-1 (topic) and level-2 (subtopic) nodes that a chart can show:
 * visible, and with a classified leaf below. Subtopics are written "Topic › Subtopic", as Cube writes them.
 */
export const collectTopicLabels = (root: TaxonomyNode | null): TDatasetTopics => {
  const topics: string[] = [];
  const subtopics: string[] = [];
  for (const topic of (root?.children ?? []).filter(isVisible)) {
    if (topic.node_type !== "branch" || !hasClassifiedLeaf(topic)) continue;
    topics.push(topic.label);
    for (const subtopic of (topic.children ?? []).filter(isVisible)) {
      if (subtopic.node_type === "branch" && hasClassifiedLeaf(subtopic)) {
        subtopics.push(`${topic.label}${TOPIC_PATH_SEPARATOR}${subtopic.label}`);
      }
    }
  }
  return { topics: uniqueSorted(topics), subtopics: uniqueSorted(subtopics) };
};

class TopicsUnavailableError extends Error {}

type TCachedTopicLabels = { active: true; labels: TDatasetTopics } | { active: false };

const loadTopicLabels = async (datasetId: string): Promise<TCachedTopicLabels> => {
  const { data, error } = await getActiveTaxonomyTree({ tenant_id: datasetId, scope_type: "directory" });
  if (error) {
    // 404: no active directory taxonomy. Hub not set up on this deployment: there cannot be one.
    if (error.status === 404 || isHubNotConfigured(error)) return { active: false };
    // Thrown rather than returned, so the failure is not cached.
    throw new TopicsUnavailableError();
  }
  return { active: true, labels: collectTopicLabels(data?.root ?? null) };
};

/**
 * A dataset's current topic labels, from its active directory taxonomy in Hub (ENG-6989). Checking the
 * caller's access to the dataset's directory is the caller's job; this adds the taxonomy entitlement.
 */
export const getDatasetTopics = async ({
  datasetId,
  organizationId,
}: TDatasetTopicsScope): Promise<TDatasetTopicsState> => {
  if (!(await getIsFeedbackDirectoriesEnabled(organizationId))) return { status: "forbidden" };
  try {
    const cached = await cache.withCache(
      () => loadTopicLabels(datasetId),
      createCacheKey.hub.directoryTopicLabels(datasetId),
      TOPIC_LABELS_TTL_MS
    );
    return cached.active ? { status: "active", labels: cached.labels } : { status: "inactive" };
  } catch (error) {
    if (error instanceof TopicsUnavailableError) return { status: "unavailable" };
    throw error;
  }
};

/** Forgets a directory's cached labels, after a change to its taxonomy made through the app. */
export const invalidateDatasetTopics = async (datasetId: string): Promise<void> => {
  await cache.del([createCacheKey.hub.directoryTopicLabels(datasetId)]);
};
