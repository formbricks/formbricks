"use client";

import { Button } from "@/modules/ui/components/button";
import Link from "next/link";

interface CardProps {
  connectText?: string;
  connectHref?: string;
  connectNewTab?: boolean;
  docsText?: string;
  docsHref?: string;
  docsNewTab?: boolean;
  label: string;
  description: string;
  icon?: React.ReactNode;
  connected?: boolean;
  statusText?: string;
  disabled?: boolean;
}

export type { CardProps };

export const Card: React.FC<CardProps> = ({
  connectText,
  connectHref,
  connectNewTab,
  docsText,
  docsHref,
  docsNewTab,
  label,
  description,
  icon,
  connected,
  statusText,
  disabled,
}) => (
  <div className="relative rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
    {connected != undefined && statusText != undefined && (
      <div className="absolute right-4 top-4 flex items-center rounded bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {connected === true ? (
          <span className="relative mr-1 flex h-2 w-2">
            <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </span>
        ) : (
          <span className="relative mr-1 flex h-2 w-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-400"></span>
          </span>
        )}
        {statusText}
      </div>
    )}

    {icon && <div className="mb-6 h-8 w-8">{icon}</div>}
    <h3 className="text-lg font-bold text-slate-800">{label}</h3>
    <p className="text-xs text-slate-500">{description}</p>
    <div className="mt-4 flex space-x-2">
      {connectHref && (
        <Button disabled={disabled} size="sm">
          <Link href={connectHref} target={connectNewTab ? "_blank" : "_self"}>
            {connectText}
          </Link>
        </Button>
      )}
      {docsHref && (
        <Button disabled={disabled} size="sm" variant="secondary">
          <Link href={docsHref} target={docsNewTab ? "_blank" : "_self"}>
            {docsText}
          </Link>
        </Button>
      )}
    </div>
  </div>
);
