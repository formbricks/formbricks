"use client";

import type { TFunction } from "i18next";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { Switch } from "@/modules/ui/components/switch";
import { useRetentionPolicies, useUpdateRetentionPolicy } from "../../hooks/use-retention-policies";
import { formatRetentionPeriod, getRetentionPolicyLabel, getRetentionPolicySummary } from "../../lib/display";
import type {
  TRetentionPolicies,
  TRetentionPoliciesPatch,
  TRetentionPolicyKind,
  TRetentionPolicySettings,
} from "../../types";
import { PolicyEditDialog } from "./policy-edit-dialog";

const POLICY_ORDER: TRetentionPolicyKind[] = ["responses", "surveys", "members"];

type TPolicyRow = { policy: TRetentionPolicyKind; settings: TRetentionPolicySettings };

/** The document as rows, with conditions filled in on the policies that have none. */
const toPolicyRows = (policies: TRetentionPolicies): TPolicyRow[] =>
  POLICY_ORDER.map((policy) => ({ policy, settings: { conditions: [], ...policies[policy] } }));

const toEnabledPatch = (policy: TRetentionPolicyKind, enabled: boolean): TRetentionPoliciesPatch => {
  switch (policy) {
    case "responses":
      return { responses: { enabled } };
    case "surveys":
      return { surveys: { enabled } };
    case "members":
      return { members: { enabled } };
  }
};

const getPolicyColumns = ({
  t,
  locale,
  canManage,
  pendingPolicy,
  onToggle,
  onEdit,
}: {
  t: TFunction;
  locale: string;
  canManage: boolean;
  pendingPolicy: TRetentionPolicyKind | null;
  onToggle: (policy: TRetentionPolicyKind, enabled: boolean) => void;
  onEdit: (policy: TRetentionPolicyKind) => void;
}): TSettingsTableColumn<TPolicyRow>[] => [
  {
    id: "data",
    header: t("workspace.settings.data_retention.data"),
    headerClassName: "w-32",
    cellClassName: "font-medium text-slate-900",
    cell: ({ policy }) => getRetentionPolicyLabel(policy, t),
  },
  {
    id: "rule",
    header: t("workspace.settings.data_retention.rule"),
    cell: ({ policy, settings }) => getRetentionPolicySummary(policy, settings, t, locale),
  },
  {
    id: "notice",
    header: t("workspace.settings.data_retention.notice"),
    headerClassName: "w-28",
    hideBelow: "md",
    cell: ({ settings }) => formatRetentionPeriod(settings.warnDays, t),
  },
  {
    id: "active",
    header: t("common.active"),
    headerClassName: "w-24",
    stopRowClick: true,
    cell: ({ policy, settings }) => (
      <Switch
        checked={settings.enabled}
        disabled={!canManage || pendingPolicy !== null}
        aria-label={t("workspace.settings.data_retention.policy_active_label", {
          policy: getRetentionPolicyLabel(policy, t),
        })}
        onCheckedChange={(enabled) => onToggle(policy, enabled)}
      />
    ),
  },
  ...(canManage
    ? [
        {
          id: "actions",
          header: null,
          srLabel: t("common.actions"),
          align: "right" as const,
          stopRowClick: true,
          cell: ({ policy }: TPolicyRow) => (
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("workspace.settings.data_retention.edit_policy", {
                policy: getRetentionPolicyLabel(policy, t),
              })}
              onClick={() => onEdit(policy)}>
              {t("common.edit")}
            </Button>
          ),
        },
      ]
    : []),
];

interface RetentionPoliciesViewProps {
  organizationId: string;
  /** Owners and managers change policies; members read them. */
  canManage: boolean;
}

/** The Policies tab: one row per kind of data, each with its rule, notice and active switch. */
export const RetentionPoliciesView = ({
  organizationId,
  canManage,
}: Readonly<RetentionPoliciesViewProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [editing, setEditing] = useState<TRetentionPolicyKind | null>(null);
  const [togglingPolicy, setTogglingPolicy] = useState<TRetentionPolicyKind | null>(null);

  const { data: policies, error, isError, isLoading, refetch } = useRetentionPolicies({ organizationId });
  const updatePolicy = useUpdateRetentionPolicy({ organizationId });

  const toggle = (policy: TRetentionPolicyKind, enabled: boolean) => {
    setTogglingPolicy(policy);
    updatePolicy.mutate(toEnabledPatch(policy, enabled), {
      onSuccess: () => {
        const label = getRetentionPolicyLabel(policy, t);
        toast.success(
          enabled
            ? t("workspace.settings.data_retention.policy_switched_on", { policy: label })
            : t("workspace.settings.data_retention.policy_paused", { policy: label })
        );
      },
      onError: (toggleError) =>
        toast.error(
          getV3ApiErrorMessage(toggleError, t("workspace.settings.data_retention.policy_save_failed"))
        ),
      onSettled: () => setTogglingPolicy(null),
    });
  };

  const rows = policies ? toPolicyRows(policies) : [];
  const editingRow = rows.find((row) => row.policy === editing);

  return (
    <>
      <SettingsCard
        title={t("workspace.settings.data_retention.policies")}
        description={
          canManage
            ? t("workspace.settings.data_retention.policies_description")
            : t("workspace.settings.data_retention.policies_read_only_description")
        }
        bodyVariant="flush">
        {isError ? (
          <div className="p-4">
            <Alert variant="error">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                {getV3ApiErrorMessage(error, t("workspace.settings.data_retention.policies_load_error"))}
                <Button variant="secondary" size="sm" onClick={() => refetch()}>
                  {t("common.try_again")}
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <SettingsTable
            aria-label={t("workspace.settings.data_retention.policies")}
            data-testid="retention-policies-table"
            columns={getPolicyColumns({
              t,
              locale,
              canManage,
              pendingPolicy: togglingPolicy,
              onToggle: toggle,
              onEdit: setEditing,
            })}
            rows={rows}
            getRowId={(row) => row.policy}
            // Never shown: the document always has all three policies, and loading and errors render apart.
            emptyMessage=""
            isLoading={isLoading}
          />
        )}
      </SettingsCard>

      {canManage && editingRow ? (
        <PolicyEditDialog
          organizationId={organizationId}
          policy={editingRow.policy}
          settings={editingRow.settings}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
};
