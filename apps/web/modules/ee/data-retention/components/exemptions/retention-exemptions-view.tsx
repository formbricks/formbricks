"use client";

import type { TFunction } from "i18next";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { useRetentionExemptions, useRevokeRetentionExemption } from "../../hooks/use-retention-exemptions";
import { formatRetentionDate, getRetentionPolicyLabel } from "../../lib/display";
import type { TRetentionExemption } from "../../types";
import { AddExemptionDialog } from "./add-exemption-dialog";

const PAGE_SIZE = 25;

const getExemptionColumns = ({
  t,
  formatDate,
  canManage,
  onRevoke,
}: {
  t: TFunction;
  formatDate: (iso: string) => string;
  canManage: boolean;
  onRevoke: (exemption: TRetentionExemption) => void;
}): TSettingsTableColumn<TRetentionExemption>[] => [
  {
    id: "survey",
    header: t("common.survey"),
    cellClassName: "font-medium text-slate-900",
    cell: (exemption) => (
      <Link
        href={`/workspaces/${exemption.workspaceId}/surveys/${exemption.surveyId}/summary`}
        className="hover:underline">
        {exemption.surveyName}
      </Link>
    ),
  },
  {
    id: "policy",
    header: t("workspace.settings.data_retention.policy"),
    cell: (exemption) => getRetentionPolicyLabel(exemption.policy, t),
  },
  {
    id: "until",
    header: t("workspace.settings.data_retention.until"),
    headerClassName: "w-32",
    cell: (exemption) => formatDate(exemption.until),
  },
  {
    id: "reason",
    header: t("workspace.settings.data_retention.reason"),
    hideBelow: "md",
    cellClassName: "whitespace-pre-line break-words",
    cell: (exemption) => exemption.reason,
  },
  {
    id: "createdBy",
    header: t("common.created_by"),
    hideBelow: "lg",
    cell: (exemption) => exemption.createdBy?.name || "—",
  },
  ...(canManage
    ? [
        {
          id: "actions",
          header: null,
          srLabel: t("common.actions"),
          align: "right" as const,
          stopRowClick: true,
          cell: (exemption: TRetentionExemption) => (
            <Button variant="ghost" size="sm" onClick={() => onRevoke(exemption)}>
              {t("workspace.settings.data_retention.revoke")}
            </Button>
          ),
        },
      ]
    : []),
];

interface RetentionExemptionsViewProps {
  organizationId: string;
  /** The organisation's display time zone: an exemption ends at the end of a day there. */
  timeZone: string;
  /** Owners and managers add and revoke exemptions; members read them. */
  canManage: boolean;
}

/** The Exemptions tab: the surveys a policy currently skips, and until when. */
export const RetentionExemptionsView = ({
  organizationId,
  timeZone,
  canManage,
}: Readonly<RetentionExemptionsViewProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [revoking, setRevoking] = useState<TRetentionExemption | null>(null);

  const {
    exemptions,
    queryKey,
    error,
    isError,
    isLoading,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useRetentionExemptions({ organizationId, limit: PAGE_SIZE });
  const revokeExemption = useRevokeRetentionExemption({ queryKey });

  const errorMessage = getV3ApiErrorMessage(
    error,
    t("workspace.settings.data_retention.exemptions_load_error")
  );

  const confirmRevoke = () => {
    if (!revoking) return;
    revokeExemption.mutate(
      { exemptionId: revoking.id },
      {
        onSuccess: () => toast.success(t("workspace.settings.data_retention.exemption_revoked")),
        onError: (revokeError) =>
          toast.error(
            getV3ApiErrorMessage(revokeError, t("workspace.settings.data_retention.exemption_revoke_failed"))
          ),
        onSettled: () => setRevoking(null),
      }
    );
  };

  return (
    <>
      <SettingsCard
        title={t("workspace.settings.data_retention.exemptions")}
        description={t("workspace.settings.data_retention.exemptions_description")}
        bodyVariant="flush"
        cta={
          canManage ? (
            <Button size="sm" onClick={() => setIsAddOpen(true)}>
              <PlusIcon />
              {t("workspace.settings.data_retention.add_exemption")}
            </Button>
          ) : undefined
        }>
        {isError && exemptions.length === 0 ? (
          <div className="p-4">
            <Alert variant="error">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                {errorMessage}
                <Button variant="secondary" size="sm" onClick={() => refetch()}>
                  {t("common.try_again")}
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <SettingsTable
            aria-label={t("workspace.settings.data_retention.exemptions")}
            data-testid="retention-exemptions-table"
            columns={getExemptionColumns({
              t,
              formatDate: (iso) => formatRetentionDate(iso, locale, timeZone),
              canManage,
              onRevoke: setRevoking,
            })}
            rows={exemptions}
            getRowId={(exemption) => exemption.id}
            emptyMessage={t("workspace.settings.data_retention.no_exemptions")}
            isLoading={isLoading}
            footer={
              hasNextPage ? (
                <div className="flex flex-col items-center gap-2 border-t border-slate-100 py-4">
                  {isFetchNextPageError ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={isFetchingNextPage}
                    onClick={() => fetchNextPage()}>
                    {t("common.load_more")}
                  </Button>
                </div>
              ) : undefined
            }
          />
        )}
      </SettingsCard>

      {canManage ? (
        <>
          <AddExemptionDialog
            organizationId={organizationId}
            timeZone={timeZone}
            open={isAddOpen}
            onOpenChange={setIsAddOpen}
          />
          <ConfirmationModal
            open={revoking !== null}
            setOpen={(open) => {
              if (!open && !revokeExemption.isPending) setRevoking(null);
            }}
            title={t("workspace.settings.data_retention.revoke_exemption_title")}
            body={
              revoking
                ? t("workspace.settings.data_retention.revoke_exemption_body", {
                    survey: revoking.surveyName,
                    policy: getRetentionPolicyLabel(revoking.policy, t),
                  })
                : null
            }
            buttonText={t("workspace.settings.data_retention.revoke")}
            buttonVariant="destructive"
            buttonLoading={revokeExemption.isPending}
            onConfirm={confirmRevoke}
          />
        </>
      ) : null}
    </>
  );
};
