"use client";

import { useTranslation } from "react-i18next";
import type { TMcpGrantPermissions } from "@/modules/mcp/grant";
import {
  type TMcpGrantPreset,
  applyMcpGrantPreset,
  getMcpGrantEditorCategories,
} from "@/modules/mcp/grant-editor";
import { Button } from "@/modules/ui/components/button";
import { McpGrantCategory } from "./mcp-grant-category";

interface McpGrantEditorProps {
  /** Unique on the page; prefixes the ids of every toggle. */
  id: string;
  permissions: TMcpGrantPermissions;
  /** What the client's scopes ask for: no level above it can be chosen. */
  cap: TMcpGrantPermissions;
  /** A Dashboard viewer sees only the Dashboards category. */
  isDashboardViewer: boolean;
  onChange: (permissions: TMcpGrantPermissions) => void;
  disabled?: boolean;
}

/**
 * The permission matrix of a grant (GLOSSARY.md "MCP access"): presets, then one expandable row per
 * category with an access level per permission. Controlled: the caller holds the permissions. Shared by
 * the consent screen and Authorized apps' Edit; the logic is `grant-editor.ts`.
 */
export const McpGrantEditor = ({
  id,
  permissions,
  cap,
  isDashboardViewer,
  onChange,
  disabled,
}: Readonly<McpGrantEditorProps>) => {
  const { t } = useTranslation();
  const categories = getMcpGrantEditorCategories({ isDashboardViewer });
  const shown = categories.flatMap((category) => category.permissions);

  const presets: { preset: TMcpGrantPreset; label: string }[] = [
    { preset: "readOnly", label: t("auth.oauth.grant.read_only") },
    { preset: "selectAll", label: t("auth.oauth.grant.select_all") },
    { preset: "deselectAll", label: t("auth.oauth.grant.deselect_all") },
  ];

  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-sm font-medium text-slate-900">
        {t("auth.oauth.grant.permissions_title")}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t("auth.oauth.grant.permissions_description")}</p>

      <fieldset className="mt-3 flex flex-wrap gap-2">
        <legend className="sr-only">{t("auth.oauth.grant.presets")}</legend>
        {presets.map(({ preset, label }) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => onChange(applyMcpGrantPreset(preset, shown, cap))}>
            {label}
          </Button>
        ))}
      </fieldset>

      <ul className="mt-3 rounded-md border border-slate-200 px-3">
        {categories.map((category) => (
          <McpGrantCategory
            key={category.category}
            id={id}
            category={category}
            permissions={permissions}
            cap={cap}
            onChange={onChange}
            showDependencyHints={!isDashboardViewer}
            disabled={disabled}
          />
        ))}
      </ul>
    </section>
  );
};
