"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { TMcpGrantPermissions } from "@/modules/mcp/grant";
import { getMcpGrantSummary } from "@/modules/mcp/grant-editor";
import { getMcpCategoryLabel, getMcpCategoryLevelLabel } from "@/modules/mcp/grant-editor-labels";

interface McpGrantSummaryProps {
  permissions: TMcpGrantPermissions;
  isDashboardViewer: boolean;
}

/** One chip per category of a grant, "Surveys · Write", as Authorized apps lists a connection. */
export const McpGrantSummary = ({ permissions, isDashboardViewer }: Readonly<McpGrantSummaryProps>) => {
  const { t } = useTranslation();

  return (
    <ul className="flex flex-wrap gap-1.5">
      {getMcpGrantSummary(permissions, { isDashboardViewer }).map(({ category, level }) => (
        <li
          key={category}
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-medium",
            level === "none"
              ? "border-slate-200 bg-white text-slate-500"
              : "border-slate-200 bg-slate-50 text-slate-700"
          )}>
          {getMcpCategoryLabel(category, t)} · {getMcpCategoryLevelLabel(level, t)}
        </li>
      ))}
    </ul>
  );
};
