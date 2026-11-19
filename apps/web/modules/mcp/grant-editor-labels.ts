import type { TMcpGrantPermissions } from "./grant";
import { type TMcpCategoryLevel, getMcpGrantSummary } from "./grant-editor";
import {
  type TMcpPermission,
  type TMcpPermissionCategory,
  type TMcpPermissionRequirement,
} from "./permissions";

/**
 * The words the grant editor shows for the registry's categories, permissions and access levels. Takes
 * `t` from the calling component.
 *
 * The maps are complete, not partial: a permission or category added to the registry without a label here
 * fails the typecheck rather than shipping English into a translated screen.
 */

type TTranslate = (key: string, values?: Record<string, string>) => string;

const CATEGORY_LABELS: Record<TMcpPermissionCategory, (t: TTranslate) => string> = {
  surveys: (t) => t("auth.oauth.grant.categories.surveys"),
  responses: (t) => t("auth.oauth.grant.categories.responses"),
  workflows: (t) => t("auth.oauth.grant.categories.workflows"),
  dashboards: (t) => t("auth.oauth.grant.categories.dashboards"),
  feedback: (t) => t("auth.oauth.grant.categories.feedback"),
  audience: (t) => t("auth.oauth.grant.categories.audience"),
};

const PERMISSION_LABELS: Record<TMcpPermission, (t: TTranslate) => string> = {
  surveys: (t) => t("auth.oauth.grant.permissions.surveys"),
  creatives: (t) => t("auth.oauth.grant.permissions.creatives"),
  surveyStyling: (t) => t("auth.oauth.grant.permissions.survey_styling"),
  responses: (t) => t("auth.oauth.grant.permissions.responses"),
  tags: (t) => t("auth.oauth.grant.permissions.tags"),
  workflows: (t) => t("auth.oauth.grant.permissions.workflows"),
  workflowRuns: (t) => t("auth.oauth.grant.permissions.workflow_runs"),
  charts: (t) => t("auth.oauth.grant.permissions.charts"),
  dashboards: (t) => t("auth.oauth.grant.permissions.dashboards"),
  feedbackRecords: (t) => t("auth.oauth.grant.permissions.feedback_records"),
  feedbackDatasets: (t) => t("auth.oauth.grant.permissions.feedback_datasets"),
  contacts: (t) => t("auth.oauth.grant.permissions.contacts"),
  contactAttributes: (t) => t("auth.oauth.grant.permissions.contact_attributes"),
  segments: (t) => t("auth.oauth.grant.permissions.segments"),
  actionClasses: (t) => t("auth.oauth.grant.permissions.action_classes"),
};

const LEVEL_LABELS: Record<Exclude<TMcpCategoryLevel, "mixed">, (t: TTranslate) => string> = {
  none: (t) => t("auth.oauth.grant.levels.no_access"),
  read: (t) => t("auth.oauth.grant.levels.read"),
  write: (t) => t("auth.oauth.grant.levels.write"),
};

export const getMcpCategoryLabel = (category: TMcpPermissionCategory, t: TTranslate): string =>
  CATEGORY_LABELS[category](t);

export const getMcpPermissionLabel = (permission: TMcpPermission, t: TTranslate): string =>
  PERMISSION_LABELS[permission](t);

export const getMcpAccessLevelLabel = (level: Exclude<TMcpCategoryLevel, "mixed">, t: TTranslate): string =>
  LEVEL_LABELS[level](t);

/** A category's level on Authorized apps' summary: "Custom" where its permissions differ. */
export const getMcpCategoryLevelLabel = (level: TMcpCategoryLevel, t: TTranslate): string =>
  level === "mixed" ? t("auth.oauth.grant.levels.custom") : getMcpAccessLevelLabel(level, t);

/** "Needs Feedback records: Read.", the hint next to a permission that needs another one. */
export const getMcpDependencyHint = (requirement: TMcpPermissionRequirement, t: TTranslate): string =>
  t("auth.oauth.grant.needs_permission", {
    permission: getMcpPermissionLabel(requirement.permission, t),
    level: getMcpAccessLevelLabel(requirement.level, t),
  });

/** One chip of a grant's summary on Authorized apps: its category, its level, and what it reads. */
export type TMcpGrantSummaryChip = {
  category: TMcpPermissionCategory;
  level: TMcpCategoryLevel;
  /** "Surveys · Write"; "Custom" where the category's permissions differ (spec story 9). */
  label: string;
};

/**
 * The chips Authorized apps shows for a grant (spec story 29): one per category the editor shows, so a
 * Dashboard viewer gets Dashboards alone, and a category the grant gives nothing reads "No access" rather
 * than disappearing.
 */
export const getMcpGrantSummaryChips = (
  permissions: TMcpGrantPermissions,
  { isDashboardViewer }: { isDashboardViewer: boolean },
  t: TTranslate
): TMcpGrantSummaryChip[] =>
  getMcpGrantSummary(permissions, { isDashboardViewer }).map(({ category, level }) => ({
    category,
    level,
    label: `${getMcpCategoryLabel(category, t)} · ${getMcpCategoryLevelLabel(level, t)}`,
  }));
