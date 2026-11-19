"use client";

import { useTranslation } from "react-i18next";
import { type TMcpCategoryLevel, type TMcpLevelOption, getMcpCappedHint } from "@/modules/mcp/grant-editor";
import { getMcpAccessLevelLabel } from "@/modules/mcp/grant-editor-labels";
import type { TMcpAccessLevel } from "@/modules/mcp/permissions";
import { InfoTooltip } from "@/modules/ui/components/info-tooltip";
import { TabToggle } from "@/modules/ui/components/tab-toggle";

interface McpGrantLevelToggleProps {
  /** Unique on the page; also names the label element the toggle's radio group is labelled by. */
  id: string;
  label: string;
  value: TMcpCategoryLevel;
  options: TMcpLevelOption[];
  onChange: (level: TMcpAccessLevel) => void;
  /** A Dashboard viewer's levels are capped by the role, not the client's scopes (`getMcpCappedHint`). */
  isDashboardViewer: boolean;
  disabled?: boolean;
}

/**
 * One No access / Read / Write toggle of the permission matrix, labelled by `label`. A level above what
 * the client asked for is disabled, with a hint to reconnect; a `mixed` value selects no level.
 */
export const McpGrantLevelToggle = ({
  id,
  label,
  value,
  options,
  onChange,
  isDashboardViewer,
  disabled,
}: Readonly<McpGrantLevelToggleProps>) => {
  const { t } = useTranslation();
  const cappedHint = getMcpCappedHint(options, { isDashboardViewer });

  return (
    <div className="flex items-center gap-1 sm:w-72">
      <span id={`${id}-toggle-label`} className="sr-only">
        {t("auth.oauth.grant.access_level_for", { name: label })}
      </span>
      <div className="flex-1">
        <TabToggle<TMcpCategoryLevel>
          id={id}
          value={value}
          disabled={disabled}
          options={options.map((option) => ({
            value: option.level,
            label: getMcpAccessLevelLabel(option.level, t),
            disabled: option.disabled,
          }))}
          onChange={(level) => {
            if (level !== "mixed") onChange(level);
          }}
        />
      </div>
      {cappedHint ? (
        <InfoTooltip label={t("auth.oauth.grant.capped_hint_label")} side="left">
          {cappedHint === "role" ? t("auth.oauth.grant.role_capped_hint") : t("auth.oauth.grant.capped_hint")}
        </InfoTooltip>
      ) : (
        <span className="size-5 shrink-0" aria-hidden="true" />
      )}
    </div>
  );
};
