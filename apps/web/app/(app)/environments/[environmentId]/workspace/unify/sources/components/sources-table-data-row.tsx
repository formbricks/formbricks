"use client";

import { formatDistanceToNow } from "date-fns";
import { FileSpreadsheetIcon, GlobeIcon, MailIcon, MessageSquareIcon, WebhookIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TSourceType } from "../types";

interface SourcesTableDataRowProps {
  id: string;
  name: string;
  type: TSourceType;
  mappingsCount: number;
  createdAt: Date;
  onClick: () => void;
}

function getSourceIcon(type: TSourceType) {
  switch (type) {
    case "formbricks":
      return <GlobeIcon className="h-4 w-4 text-slate-500" />;
    case "webhook":
      return <WebhookIcon className="h-4 w-4 text-slate-500" />;
    case "email":
      return <MailIcon className="h-4 w-4 text-slate-500" />;
    case "csv":
      return <FileSpreadsheetIcon className="h-4 w-4 text-slate-500" />;
    case "slack":
      return <MessageSquareIcon className="h-4 w-4 text-slate-500" />;
    default:
      return <GlobeIcon className="h-4 w-4 text-slate-500" />;
  }
}

export function SourcesTableDataRow({
  id,
  name,
  type,
  mappingsCount,
  createdAt,
  onClick,
}: SourcesTableDataRowProps) {
  const { t } = useTranslation();

  const getSourceTypeLabel = (sourceType: TSourceType) => {
    switch (sourceType) {
      case "formbricks":
        return t("environments.unify.formbricks_surveys");
      case "webhook":
        return t("environments.unify.webhook");
      case "email":
        return t("environments.unify.email");
      case "csv":
        return t("environments.unify.csv_import");
      case "slack":
        return t("environments.unify.slack_message");
      default:
        return sourceType;
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
        {getSourceIcon(type)}
        <span className="hidden truncate text-xs text-slate-500 sm:inline">{getSourceTypeLabel(type)}</span>
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
