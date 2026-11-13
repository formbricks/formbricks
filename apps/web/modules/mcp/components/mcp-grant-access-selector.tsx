"use client";

import { useTranslation } from "react-i18next";
import type { TMcpGrantAccess } from "@/modules/mcp/grant";
import {
  type TMcpGrantAccessDraft,
  type TMcpGrantAccessOptions,
  toMcpGrantAccessSelection,
} from "@/modules/mcp/grant-access";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { TabToggle } from "@/modules/ui/components/tab-toggle";

interface McpGrantAccessSelectorProps {
  /** Unique on the page; prefixes the ids of the toggle. */
  id: string;
  value: TMcpGrantAccessDraft;
  options: TMcpGrantAccessOptions;
  onChange: (value: TMcpGrantAccessDraft) => void;
  disabled?: boolean;
}

/**
 * A grant's organization & workspace access (GLOSSARY.md "MCP access"): All access, Only selected
 * organizations, or Only selected workspaces, with a picker for the selection. Controlled: the caller
 * holds the draft. Shared by the consent screen and Authorized apps' Edit; the rules are in
 * `grant-access.ts`.
 */
export const McpGrantAccessSelector = ({
  id,
  value,
  options,
  onChange,
  disabled,
}: Readonly<McpGrantAccessSelectorProps>) => {
  const { t } = useTranslation();

  const modes: { value: TMcpGrantAccess; label: string }[] = [
    { value: "all", label: t("auth.oauth.access.all") },
    { value: "organizations", label: t("auth.oauth.access.organizations") },
    { value: "workspaces", label: t("auth.oauth.access.workspaces") },
  ];
  const hints: Record<TMcpGrantAccess, string> = {
    all: t("auth.oauth.access.all_hint"),
    organizations: t("auth.oauth.access.organizations_hint"),
    workspaces: t("auth.oauth.access.workspaces_hint"),
  };
  const nothingPicked = toMcpGrantAccessSelection(value) === null;
  const noOptions =
    (value.access === "organizations" && options.organizations.length === 0) ||
    (value.access === "workspaces" && options.workspaces.length === 0);

  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-sm font-medium text-slate-900">
        {t("auth.oauth.access.title")}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t("auth.oauth.access.description")}</p>

      <span id={`${id}-toggle-label`} className="sr-only">
        {t("auth.oauth.access.mode_label")}
      </span>
      <TabToggle
        id={id}
        options={modes}
        value={value.access}
        onChange={(access) => onChange({ ...value, access })}
        disabled={disabled}
      />
      <p className="mt-2 text-sm text-slate-600">{hints[value.access]}</p>

      {value.access === "organizations" && (
        <div className="mt-2">
          <MultiSelect
            options={options.organizations.map(({ id: organizationId, name }) => ({
              value: organizationId,
              label: name,
            }))}
            value={value.organizationIds}
            onChange={(organizationIds) => onChange({ ...value, organizationIds })}
            placeholder={t("auth.oauth.access.pick_organizations")}
            disabled={disabled}
          />
        </div>
      )}
      {value.access === "workspaces" && (
        <div className="mt-2">
          <MultiSelect
            options={options.workspaces.map((workspace) => ({
              value: workspace.id,
              label: workspace.name,
              group: workspace.organizationName,
            }))}
            value={value.workspaceIds}
            onChange={(workspaceIds) => onChange({ ...value, workspaceIds })}
            placeholder={t("auth.oauth.access.pick_workspaces")}
            disabled={disabled}
          />
        </div>
      )}
      {nothingPicked && (
        <output className="mt-2 block text-sm text-slate-600">
          {noOptions ? t("auth.oauth.access.no_options") : t("auth.oauth.access.none_picked_hint")}
        </output>
      )}
    </section>
  );
};
