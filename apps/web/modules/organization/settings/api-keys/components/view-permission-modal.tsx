"use client";

import {
  TApiKeyWithEnvironmentPermission,
  TOrganizationProject,
} from "@/modules/organization/settings/api-keys/types/api-keys";
import { DropdownMenu, DropdownMenuTrigger } from "@/modules/ui/components/dropdown-menu";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";

interface ViewPermissionModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  apiKey: TApiKeyWithEnvironmentPermission;
  projects: TOrganizationProject[];
}

export const ViewPermissionModal = ({ open, setOpen, apiKey, projects }: ViewPermissionModalProps) => {
  const { t } = useTranslate();

  const getProjectName = (environmentId: string) => {
    return projects.find((project) => project.environments.find((env) => env.id === environmentId))?.name;
  };

  const getEnvironmentName = (environmentId: string) => {
    return projects
      .find((project) => project.environments.find((env) => env.id === environmentId))
      ?.environments.find((env) => env.id === environmentId)?.type;
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={true}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="text-xl font-medium text-slate-700">
                {t("environments.project.api_keys.api_key")}
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="flex flex-col justify-between rounded-lg p-6">
            <div className="w-full space-y-6">
              <div className="space-y-2">
                <Label>{t("environments.project.api_keys.permissions")}</Label>
                <div className="space-y-2">
                  {/* Permission rows */}
                  {apiKey.apiKeyEnvironments?.map((permission) => {
                    return (
                      <div key={permission.environmentId} className="flex items-center gap-2">
                        {/* Project dropdown */}
                        <div className="w-1/3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none">
                                <span className="flex w-4/5 flex-1">
                                  <span className="w-full truncate text-left">
                                    {getProjectName(permission.environmentId)}
                                  </span>
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                          </DropdownMenu>
                        </div>

                        {/* Environment dropdown */}
                        <div className="w-1/3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none">
                                <span className="flex w-4/5 flex-1">
                                  <span className="w-full truncate text-left capitalize">
                                    {getEnvironmentName(permission.environmentId)}
                                  </span>
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                          </DropdownMenu>
                        </div>

                        {/* Permission level dropdown */}
                        <div className="w-1/3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none">
                                <span className="flex w-4/5 flex-1">
                                  <span className="w-full truncate text-left capitalize">
                                    {permission.permission}
                                  </span>
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
