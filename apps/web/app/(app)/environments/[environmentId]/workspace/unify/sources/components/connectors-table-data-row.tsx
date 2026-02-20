"use client";

import { formatDistanceToNow } from "date-fns";
import { FileSpreadsheetIcon, GlobeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TConnectorType } from "@formbricks/types/connector";

interface ConnectorsTableDataRowProps {
  id: string;
  name: string;
  type: TConnectorType;
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

export function ConnectorsTableDataRow({
  id,
  name,
  type,
  mappingsCount,
  createdAt,
  onClick,
}: ConnectorsTableDataRowProps) {
  const { t } = useTranslation();

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
      <div className="col-span-5 flex items-center">
        <span className="truncate font-medium text-slate-900">{name}</span>
      </div>
      <div className="col-span-2 hidden items-center justify-center text-sm text-slate-600 sm:flex">
        {mappingsCount} {mappingsCount === 1 ? t("environments.unify.field") : t("environments.unify.fields")}
      </div>
      <div className="col-span-3 hidden items-center justify-end pr-4 text-sm text-slate-500 sm:flex">
        {formatDistanceToNow(createdAt, { addSuffix: true })}
      </div>
    </div>
  );
}
