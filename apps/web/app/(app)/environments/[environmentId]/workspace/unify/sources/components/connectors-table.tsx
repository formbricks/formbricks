"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TConnectorWithMappings } from "@formbricks/types/connector";
import { ConnectorsTableDataRow } from "./connectors-table-data-row";

interface ConnectorsTableProps {
  connectors: TConnectorWithMappings[];
  onConnectorClick: (connector: TConnectorWithMappings) => void;
  isLoading?: boolean;
}

export function ConnectorsTable({ connectors, onConnectorClick, isLoading = false }: ConnectorsTableProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-12 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-2 pl-6">{t("common.type")}</div>
        <div className="col-span-5">{t("common.name")}</div>
        <div className="col-span-2 hidden text-center sm:block">{t("common.mappings")}</div>
        <div className="col-span-3 hidden pr-6 text-right sm:block">{t("common.created")}</div>
      </div>
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2Icon className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : connectors.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-slate-500">{t("environments.unify.no_sources_connected")}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {connectors.map((connector) => (
            <ConnectorsTableDataRow
              key={connector.id}
              id={connector.id}
              name={connector.name}
              type={connector.type}
              mappingsCount={connector.formbricksMappings.length + connector.fieldMappings.length}
              createdAt={connector.createdAt}
              onClick={() => onConnectorClick(connector)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
