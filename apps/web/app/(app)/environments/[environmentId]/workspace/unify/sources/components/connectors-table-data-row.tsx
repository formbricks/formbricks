"use client";

import { FileSpreadsheetIcon, GlobeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TConnectorStatus, TConnectorType } from "@formbricks/types/connector";
import { Badge } from "@/modules/ui/components/badge";

const RELATIVE_TIME_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.345, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

function getRelativeTime(date: Date, locale: string): string {
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
  id: string;
  name: string;
  type: TConnectorType;
  status: TConnectorStatus;
  mappingsCount: number;
  createdAt: Date;
  onClick: () => void;
}

function getConnectorIcon(type: TConnectorType) {
  switch (type) {
    case "formbricks":
      return <GlobeIcon className="h-4 w-4 text-slate-500" />;
    case "csv":
      return <FileSpreadsheetIcon className="h-4 w-4 text-slate-500" />;
    default:
      return <GlobeIcon className="h-4 w-4 text-slate-500" />;
  }
}

const STATUS_BADGE_CONFIG: Record<
  TConnectorStatus,
  { textKey: string; type: "success" | "warning" | "error" }
> = {
  active: { textKey: "environments.unify.status_active", type: "success" },
  paused: { textKey: "environments.unify.status_paused", type: "warning" },
  error: { textKey: `environments.unify.status_error`, type: "error" },
};

export function ConnectorsTableDataRow({
  id,
  name,
  type,
  status,
  mappingsCount,
  createdAt,
  onClick,
}: ConnectorsTableDataRowProps) {
  const { t, i18n } = useTranslation();

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
      key={id}
      role="button"
      tabIndex={0}
      className="grid h-12 min-h-12 cursor-pointer grid-cols-12 content-center p-2 text-left transition-colors ease-in-out hover:bg-slate-50"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick();
        }
      }}>
      <div className="col-span-2 flex items-center gap-2 pl-4">
        {getConnectorIcon(type)}
        <span className="hidden truncate text-xs text-slate-500 sm:inline">
          {getConnectorTypeLabel(type)}
        </span>
      </div>
      <div className="col-span-4 flex items-center">
        <span className="truncate text-sm font-medium text-slate-900">{name}</span>
      </div>
      <div className="col-span-2 hidden items-center justify-center sm:flex">
        <Badge
          text={t(STATUS_BADGE_CONFIG[status].textKey)}
          type={STATUS_BADGE_CONFIG[status].type}
          size="tiny"
        />
      </div>
      <div className="col-span-2 hidden items-center justify-center text-sm text-slate-600 sm:flex">
        {mappingsCount} {mappingsCount === 1 ? t("environments.unify.field") : t("environments.unify.fields")}
      </div>
      <div className="col-span-2 hidden items-center justify-end pr-4 text-sm text-slate-500 sm:flex">
        {getRelativeTime(createdAt, i18n.language)}
      </div>
    </div>
  );
}
