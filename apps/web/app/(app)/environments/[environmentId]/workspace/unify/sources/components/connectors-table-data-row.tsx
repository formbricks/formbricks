"use client";

import { FileSpreadsheetIcon, FormIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TConnectorStatus, TConnectorType, TConnectorWithMappings } from "@formbricks/types/connector";
import { Badge } from "@/modules/ui/components/badge";
import { ConnectorRowDropdown } from "./connector-row-dropdown";

const RELATIVE_TIME_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.345, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

function getRelativeTime(date: Date, locale: string) {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let duration = (date.getTime() - Date.now()) / 1000;

  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return formatter.format(Math.round(duration), "years");
}

interface ConnectorsTableDataRowProps {
  connector: TConnectorWithMappings;
  onEdit: () => void;
  onCsvImport?: () => void;
  onDuplicate: () => Promise<void>;
  onToggleStatus: () => Promise<void>;
  onDelete: () => Promise<void>;
}

function getConnectorIcon(type: TConnectorType) {
  switch (type) {
    case "formbricks":
      return <FormIcon className="h-4 w-4 text-slate-500" />;
    case "csv":
      return <FileSpreadsheetIcon className="h-4 w-4 text-slate-500" />;
    default:
      return <FormIcon className="h-4 w-4 text-slate-500" />;
  }
}

const STATUS_BADGE_TYPE: Record<TConnectorStatus, "success" | "warning" | "error"> = {
  active: "success",
  paused: "warning",
  error: "error",
};

export function ConnectorsTableDataRow({
  connector,
  onEdit,
  onCsvImport,
  onDuplicate,
  onToggleStatus,
  onDelete,
}: ConnectorsTableDataRowProps) {
  const { t, i18n } = useTranslation();

  const getStatusLabel = (s: TConnectorStatus) => {
    switch (s) {
      case "active":
        return t("environments.unify.status_active");
      case "paused":
        return t("environments.unify.status_paused");
      case "error":
        return t("environments.unify.status_error");
    }
  };

  const getConnectorTypeLabel = (connectorType: TConnectorType) => {
    switch (connectorType) {
      case "formbricks":
        return t("environments.unify.formbricks_surveys");
      case "csv":
        return t("environments.unify.csv_import");
      default:
        return connectorType;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="grid h-12 min-h-12 cursor-pointer grid-cols-12 content-center p-2 text-left transition-colors ease-in-out hover:bg-slate-50"
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onEdit();
        }
      }}>
      <div className="col-span-1 flex items-center gap-2 pl-4" title={getConnectorTypeLabel(connector.type)}>
        {getConnectorIcon(connector.type)}
      </div>
      <div className="col-span-3 flex items-center">
        <span className="truncate text-sm font-medium text-slate-900">{connector.name}</span>
      </div>
      <div className="col-span-1 hidden items-center justify-center sm:flex">
        <Badge
          text={getStatusLabel(connector.status)}
          type={STATUS_BADGE_TYPE[connector.status]}
          size="tiny"
        />
      </div>
      <div className="col-span-2 hidden items-center justify-center text-sm text-slate-500 sm:flex">
        {getRelativeTime(connector.createdAt, i18n.language)}
      </div>
      <div className="col-span-2 hidden items-center justify-center text-sm text-slate-500 sm:flex">
        {getRelativeTime(connector.updatedAt, i18n.language)}
      </div>
      <div className="col-span-2 hidden items-center justify-center text-sm text-slate-500 sm:flex">
        <span className="truncate">{connector.creatorName ?? "—"}</span>
      </div>
      <div className="col-span-1 flex items-center justify-end pr-2">
        <ConnectorRowDropdown
          connector={connector}
          onEdit={onEdit}
          onCsvImport={onCsvImport}
          onDuplicate={onDuplicate}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
