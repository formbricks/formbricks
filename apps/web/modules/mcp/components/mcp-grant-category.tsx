"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { TMcpGrantPermissions } from "@/modules/mcp/grant";
import {
  type TMcpGrantEditorCategory,
  getMcpCategoryLevel,
  getMcpLevelOptions,
  getUnmetMcpPermissionDependencies,
  setMcpCategoryLevel,
  setMcpPermissionLevel,
} from "@/modules/mcp/grant-editor";
import {
  getMcpCategoryLabel,
  getMcpDependencyHint,
  getMcpPermissionLabel,
} from "@/modules/mcp/grant-editor-labels";
import { MCP_PERMISSION_DEPENDENCIES } from "@/modules/mcp/permissions";
import { McpGrantLevelToggle } from "./mcp-grant-level-toggle";

interface McpGrantCategoryProps {
  id: string;
  category: TMcpGrantEditorCategory;
  permissions: TMcpGrantPermissions;
  cap: TMcpGrantPermissions;
  onChange: (permissions: TMcpGrantPermissions) => void;
  /** Dependency hints name permissions in other categories; hidden when those aren't shown. */
  showDependencyHints: boolean;
  disabled?: boolean;
}

/**
 * A category row of the permission matrix: its own toggle sets every permission in it, and it expands
 * to one toggle per permission.
 */
export const McpGrantCategory = ({
  id,
  category,
  permissions,
  cap,
  onChange,
  showDependencyHints,
  disabled,
}: Readonly<McpGrantCategoryProps>) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const categoryId = `${id}-${category.category}`;
  const label = getMcpCategoryLabel(category.category, t);
  const unmet = getUnmetMcpPermissionDependencies(permissions);

  return (
    <li className="border-b border-slate-200 last:border-b-0">
      <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="flex items-center gap-2 rounded-md text-left text-sm font-medium text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden"
          aria-expanded={isExpanded}
          aria-controls={`${categoryId}-permissions`}
          aria-label={
            isExpanded
              ? t("auth.oauth.grant.collapse_category", { category: label })
              : t("auth.oauth.grant.expand_category", { category: label })
          }
          onClick={() => setIsExpanded((expanded) => !expanded)}>
          {isExpanded ? (
            <ChevronDownIcon className="size-4 text-slate-500" aria-hidden="true" />
          ) : (
            <ChevronRightIcon className="size-4 text-slate-500" aria-hidden="true" />
          )}
          <span aria-hidden="true">{label}</span>
        </button>
        <McpGrantLevelToggle
          id={categoryId}
          label={label}
          value={getMcpCategoryLevel(permissions, category.permissions)}
          options={getMcpLevelOptions(category.permissions, cap)}
          disabled={disabled}
          onChange={(level) => onChange(setMcpCategoryLevel(permissions, category.permissions, level, cap))}
        />
      </div>

      <ul id={`${categoryId}-permissions`} hidden={!isExpanded} className="pb-3 pl-6">
        {category.permissions.map((permission) => {
          const permissionLabel = getMcpPermissionLabel(permission, t);
          const dependencies = MCP_PERMISSION_DEPENDENCIES[permission] ?? [];
          const isUnmet = Boolean(unmet[permission]);
          return (
            <li
              key={permission}
              className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-700">
                <span>{permissionLabel}</span>
                {showDependencyHints &&
                  dependencies.map((requirement) => (
                    <p
                      key={requirement.permission}
                      className={cn("mt-0.5 text-xs", isUnmet ? "text-amber-700" : "text-slate-500")}>
                      {getMcpDependencyHint(requirement, t)}
                    </p>
                  ))}
              </div>
              <McpGrantLevelToggle
                id={`${categoryId}-${permission}`}
                label={permissionLabel}
                value={permissions[permission] ?? "none"}
                options={getMcpLevelOptions([permission], cap)}
                disabled={disabled}
                onChange={(level) => onChange(setMcpPermissionLevel(permissions, permission, level, cap))}
              />
            </li>
          );
        })}
      </ul>
    </li>
  );
};
