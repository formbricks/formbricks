import type { TFunction } from "i18next";
import {
  type TWorkflowRunStatus,
  type TWorkflowTriggerType,
  WORKFLOW_TRIGGERS,
  ZWorkflowRunStatus,
} from "@formbricks/workflows";
import { getWorkflowRunStatusBadge, getWorkflowTriggerTypeLabel } from "@/modules/ee/workflows/lib/display";
import { resolveEnumFilter } from "@/modules/ui/components/table-toolbar/lib/enum-filters";
import { isHiddenToggleOn, setHiddenToggle } from "@/modules/ui/components/table-toolbar/lib/hidden-toggle";
import { ENUM_RULE_OPERATORS } from "@/modules/ui/components/table-toolbar/lib/operators";
import type { TFilterProperty, TTableFilter } from "@/modules/ui/components/table-toolbar/lib/types";
import type { TWorkflowRunListFilters } from "./api-client";

/**
 * The Runs tables on the shared toolbar, as the Workflows list has it: Status (and, across workflows,
 * Trigger) as filters, and "Hide test runs" in the gear like "Show archived". Pure, so it is tested here.
 */

export const SHOW_TEST_RUNS_PROPERTY = "testRuns";

const RUN_STATUSES = ZWorkflowRunStatus.options;
const TRIGGER_TYPES: TWorkflowTriggerType[] = Object.values(WORKFLOW_TRIGGERS);

/** The runs list has one order, newest first: the toolbar offers no sort. */
export const RUN_SORT_VALUES = ["newest"] as const;
export const DEFAULT_RUN_SORT = "newest";

/** Inside one workflow every run has the same trigger, so only the workspace list filters by it. */
export const getRunFilterProperties = (t: TFunction, { withTrigger }: { withTrigger: boolean }) => {
  const properties: TFilterProperty[] = [
    {
      id: "status",
      label: t("common.status"),
      valueType: "enum",
      quick: true,
      ruleOperators: ENUM_RULE_OPERATORS,
      options: RUN_STATUSES.map((status) => ({
        value: status,
        label: getWorkflowRunStatusBadge(status, t).label,
      })),
    },
  ];
  if (withTrigger) {
    properties.push({
      id: "triggerType",
      label: t("common.trigger"),
      valueType: "enum",
      quick: true,
      ruleOperators: ENUM_RULE_OPERATORS,
      options: TRIGGER_TYPES.map((triggerType) => ({
        value: triggerType,
        label: getWorkflowTriggerTypeLabel(triggerType, t),
      })),
    });
  }
  properties.push({
    id: SHOW_TEST_RUNS_PROPERTY,
    label: t("workspace.workflows.show_test_runs"),
    valueType: "enum",
    hidden: true,
    options: [{ value: "true", label: t("workspace.workflows.show_test_runs") }],
  });
  return properties;
};

export const isShowingTestRuns = (filters: readonly TTableFilter[]) =>
  isHiddenToggleOn(filters, SHOW_TEST_RUNS_PROPERTY);

/** Test runs are hidden by default: the gear's "Hide test runs" is on until switched off. */
export const setHideTestRuns = (filters: readonly TTableFilter[], hide: boolean): TTableFilter[] =>
  setHiddenToggle(filters, SHOW_TEST_RUNS_PROPERTY, !hide);

/**
 * The API filters for the toolbar's filters, or null when they exclude every status or trigger and
 * nothing can match.
 */
export const toRunListFilters = (
  filters: readonly TTableFilter[],
  base: TWorkflowRunListFilters = {}
): TWorkflowRunListFilters | null => {
  const statusIn = resolveEnumFilter<TWorkflowRunStatus>(filters, "status", RUN_STATUSES);
  const triggerTypeIn = resolveEnumFilter<TWorkflowTriggerType>(filters, "triggerType", TRIGGER_TYPES);
  if (statusIn?.length === 0 || triggerTypeIn?.length === 0) return null;
  return {
    ...base,
    ...(statusIn ? { statusIn } : {}),
    ...(triggerTypeIn ? { triggerTypeIn } : {}),
    ...(isShowingTestRuns(filters) ? {} : { isDryRun: false }),
  };
};
