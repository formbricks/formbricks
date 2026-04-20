"use client";

import { Trash2Icon } from "lucide-react";
import { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TTeamSettingsFormSchema } from "@/modules/ee/teams/team-list/types/team";
import { ZTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { Button } from "@/modules/ui/components/button";
import { FormError, FormField, FormItem } from "@/modules/ui/components/form";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";

export interface WorkspaceRowProps {
  index: number;
  workspace: { workspaceId: string; permission: string };
  workspaceOpts: { value: string; label: string }[];
  control: Control<TTeamSettingsFormSchema>;
  initialWorkspaceIds: Set<string>;
  isOwnerOrManager: boolean;
  onRemoveWorkspace: (index: number) => void;
  workspaceCount: number;
}

export function WorkspaceRow(props: Readonly<WorkspaceRowProps>) {
  const {
    index,
    workspace,
    workspaceOpts,
    control,
    initialWorkspaceIds,
    isOwnerOrManager,
    onRemoveWorkspace,
    workspaceCount,
  } = props;
  const { t } = useTranslation();

  return (
    <div className="flex gap-2.5">
      <FormField
        control={control}
        name={`workspaces.${index}.workspaceId`}
        render={({ field, fieldState: { error } }) => {
          const isExistingWorkspace = workspace.workspaceId && initialWorkspaceIds.has(workspace.workspaceId);
          const isSelectDisabled = isExistingWorkspace || !isOwnerOrManager;

          return (
            <FormItem className="flex-1">
              <div className={isSelectDisabled ? "pointer-events-none opacity-50" : undefined}>
                <InputCombobox
                  id={`workspace-select-${index}`}
                  options={workspaceOpts}
                  value={field.value || null}
                  onChangeValue={(val) => {
                    const value = typeof val === "string" ? val : "";
                    field.onChange(value);
                  }}
                  showSearch
                  searchPlaceholder={t("common.search")}
                  comboboxClasses="flex-1 min-w-0 w-full"
                  emptyDropdownText={t("workspace.surveys.edit.no_option_found")}
                />
              </div>
              {error?.message && <FormError className="text-left">{error.message}</FormError>}
            </FormItem>
          );
        }}
      />
      <FormField
        control={control}
        name={`workspaces.${index}.permission`}
        render={({ field }) => {
          const permissionOptions = [
            {
              value: ZTeamPermission.enum.read,
              label: t("workspace.settings.teams.read"),
            },
            {
              value: ZTeamPermission.enum.readWrite,
              label: t("workspace.settings.teams.read_write"),
            },
            {
              value: ZTeamPermission.enum.manage,
              label: t("workspace.settings.teams.manage"),
            },
          ];

          return (
            <FormItem className="flex-1">
              <div className={isOwnerOrManager ? undefined : "pointer-events-none opacity-50"}>
                <InputCombobox
                  id={`workspace-permission-select-${index}`}
                  options={permissionOptions}
                  value={field.value}
                  onChangeValue={(val) => field.onChange(val)}
                  showSearch={false}
                  comboboxClasses="flex-1 min-w-0 w-full"
                />
              </div>
            </FormItem>
          );
        }}
      />
      {workspaceCount > 1 && (
        <Button
          size="icon"
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={!isOwnerOrManager}
          onClick={() => onRemoveWorkspace(index)}>
          <Trash2Icon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
