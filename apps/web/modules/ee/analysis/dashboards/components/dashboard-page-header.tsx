"use client";

import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface DashboardPageHeaderProps {
  name: string;
  isEditing: boolean;
  onNameChange: (name: string) => void;
  cta?: ReactNode;
}

export function DashboardPageHeader({
  name,
  isEditing,
  onNameChange,
  cta,
}: Readonly<DashboardPageHeaderProps>) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-slate-200">
      <div className="flex items-center justify-between space-x-4 pb-4">
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="focus:border-brand-dark w-full rounded-md border border-dashed border-slate-300 bg-transparent px-2 py-1 text-3xl font-bold text-slate-800 focus:outline-none focus:ring-0"
            aria-label={t("environments.analysis.dashboards.dashboard_name_placeholder")}
            placeholder={t("environments.analysis.dashboards.dashboard_name_placeholder")}
          />
        ) : (
          <h1 className="border border-transparent px-2 py-1 text-3xl font-bold text-slate-800">{name}</h1>
        )}
        {cta}
      </div>
    </div>
  );
}
