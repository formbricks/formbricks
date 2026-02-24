"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TConnectorWithMappings } from "@formbricks/types/connector";
import { ConnectorsTableRowsContainer } from "@/app/(app)/environments/[environmentId]/workspace/unify/sources/components/connectors-table-rows-container";

interface ConnectorsTableProps {
  connectors: TConnectorWithMappings[];
  onConnectorClick: (connector: TConnectorWithMappings) => void;
  onDuplicate: (connector: TConnectorWithMappings) => Promise<void>;
  onToggleStatus: (connector: TConnectorWithMappings) => Promise<void>;
  onDelete: (connectorId: string) => Promise<void>;
  isLoading?: boolean;
}

export function ConnectorsTable({
  connectors,
  onConnectorClick,
  onDuplicate,
  onToggleStatus,
  onDelete,
  isLoading = false,
}: ConnectorsTableProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-12 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-1 pl-6">{t("common.type")}</div>
        <div className="col-span-3">{t("common.name")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.status")}</div>
        <div className="col-span-2 hidden text-center sm:block">{t("common.created")}</div>
        <div className="col-span-2 hidden text-center sm:block">{t("environments.unify.updated_at")}</div>
        <div className="col-span-2 hidden text-center sm:block">{t("environments.unify.created_by")}</div>
        <div className="col-span-1" />
      </div>
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2Icon className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : (
        <ConnectorsTableRowsContainer
          connectors={connectors}
          onConnectorClick={onConnectorClick}
          onDuplicate={onDuplicate}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
