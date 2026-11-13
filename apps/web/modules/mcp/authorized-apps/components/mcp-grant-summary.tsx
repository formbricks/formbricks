"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "@/modules/mcp/grant";
import { getMcpGrantAccessSummary } from "@/modules/mcp/grant-access";
import { getMcpGrantSummary } from "@/modules/mcp/grant-editor";
import { getMcpCategoryLabel, getMcpCategoryLevelLabel } from "@/modules/mcp/grant-editor-labels";

interface McpGrantSummaryProps {
  permissions: TMcpGrantPermissions;
  /** The grant's organization & workspace access; `null` for a client without a grant. */
  access: TMcpGrantAccessSelection | null;
  isDashboardViewer: boolean;
}

/**
 * A grant as Authorized apps lists a client: its organization & workspace access ("All access",
 * "3 workspaces", "No workspaces"), then one chip per category, "Surveys · Write".
 */
export const McpGrantSummary = ({
  permissions,
  access,
  isDashboardViewer,
}: Readonly<McpGrantSummaryProps>) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-1.5">
      {access && <p className="text-sm font-medium text-slate-700">{getMcpGrantAccessSummary(access, t)}</p>}
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
    </div>
  );
};
