"use client";

import { formatDistanceToNow } from "date-fns";
import { FileSpreadsheetIcon, GlobeIcon, MailIcon, MessageSquareIcon, WebhookIcon } from "lucide-react";
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

function getSourceTypeLabel(type: TSourceType) {
  switch (type) {
    case "formbricks":
      return "Formbricks";
    case "webhook":
      return "Webhook";
    case "email":
      return "Email";
    case "csv":
      return "CSV";
    case "slack":
      return "Slack";
    default:
      return type;
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
        {mappingsCount} {mappingsCount === 1 ? "field" : "fields"}
      </div>
      <div className="col-span-3 hidden items-center justify-end pr-4 text-sm text-slate-500 sm:flex">
        {formatDistanceToNow(createdAt, { addSuffix: true })}
      </div>
    </div>
  );
}
