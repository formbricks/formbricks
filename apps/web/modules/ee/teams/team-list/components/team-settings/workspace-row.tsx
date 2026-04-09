"use client";

import { Trash2Icon } from "lucide-react";
import { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ZTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { TTeamSettingsFormSchema } from "@/modules/ee/teams/team-list/types/team";
import { Button } from "@/modules/ui/components/button";
import { FormError, FormField, FormItem } from "@/modules/ui/components/form";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";

export interface WorkspaceRowProps {
  index: number;
  project: { projectId: string; permission: string };
  projectOpts: { value: string; label: string }[];
  control: Control<TTeamSettingsFormSchema>;
  initialProjectIds: Set<string>;
  isOwnerOrManager: boolean;
  onRemoveProject: (index: number) => void;
  projectCount: number;
}

export function WorkspaceRow(props: Readonly<WorkspaceRowProps>) {
  const {
    index,
    project,
    projectOpts,
    control,
    initialProjectIds,
    isOwnerOrManager,
    onRemoveProject,
    projectCount,
  } = props;
  const { t } = useTranslation();

  return (
    <div className="flex gap-2.5">
      <FormField
        control={control}
        name={`projects.${index}.projectId`}
        render={({ field, fieldState: { error } }) => {
          const isExistingProject = project.projectId && initialProjectIds.has(project.projectId);
          const isSelectDisabled = isExistingProject || !isOwnerOrManager;

          return (
            <FormItem className="flex-1">
              <div className={isSelectDisabled ? "pointer-events-none opacity-50" : undefined}>
                <InputCombobox
                  id={`project-select-${index}`}
                  options={projectOpts}
                  value={field.value || null}
                  onChangeValue={(val) => {
                    const value = typeof val === "string" ? val : "";
                    field.onChange(value);
                  }}
                  showSearch
                  searchPlaceholder={t("common.search")}
                  comboboxClasses="flex-1 min-w-0 w-full"
                  emptyDropdownText={t("environments.surveys.edit.no_option_found")}
                />
              </div>
              {error?.message && <FormError className="text-left">{error.message}</FormError>}
            </FormItem>
          );
        }}
      />
      <FormField
        control={control}
        name={`projects.${index}.permission`}
        render={({ field }) => {
          const permissionOptions = [
            {
              value: ZTeamPermission.enum.read,
              label: t("environments.settings.teams.read"),
            },
            {
              value: ZTeamPermission.enum.readWrite,
              label: t("environments.settings.teams.read_write"),
            },
            {
              value: ZTeamPermission.enum.manage,
              label: t("environments.settings.teams.manage"),
            },
          ];

          return (
            <FormItem className="flex-1">
              <div className={isOwnerOrManager ? undefined : "pointer-events-none opacity-50"}>
                <InputCombobox
                  id={`project-permission-select-${index}`}
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
      {projectCount > 1 && (
        <Button
          size="icon"
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={!isOwnerOrManager}
          onClick={() => onRemoveProject(index)}>
          <Trash2Icon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
