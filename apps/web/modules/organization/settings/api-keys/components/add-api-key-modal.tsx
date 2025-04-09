"use client";

import { getOrganizationAccessKeyDisplayName } from "@/modules/organization/settings/api-keys/lib/utils";
import { TOrganizationProject } from "@/modules/organization/settings/api-keys/types/api-keys";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
import { Switch } from "@/modules/ui/components/switch";
import { ApiKeyPermission } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { Fragment, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { TOrganizationAccess } from "@formbricks/types/api-key";

interface AddApiKeyModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: {
    label: string;
    environmentPermissions: Array<{ environmentId: string; permission: ApiKeyPermission }>;
    organizationAccess: TOrganizationAccess;
  }) => Promise<void>;
  projects: TOrganizationProject[];
  isCreatingAPIKey: boolean;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface PermissionRecord {
  projectId: string;
  environmentId: string;
  permission: ApiKeyPermission;
  projectName: string;
  environmentType: string;
}

const permissionOptions: ApiKeyPermission[] = [
  ApiKeyPermission.read,
  ApiKeyPermission.write,
  ApiKeyPermission.manage,
];

export const AddApiKeyModal = ({
  open,
  setOpen,
  onSubmit,
  projects,
  isCreatingAPIKey,
}: AddApiKeyModalProps) => {
  const { t } = useTranslate();
  const { register, getValues, handleSubmit, reset, watch } = useForm<{ label: string }>();
  const apiKeyLabel = watch("label");
  const defaultOrganizationAccess: TOrganizationAccess = {
    accessControl: {
      read: false,
      write: false,
    },
  };

  const [selectedOrganizationAccess, setSelectedOrganizationAccess] =
    useState<TOrganizationAccess>(defaultOrganizationAccess);

  const getInitialPermissions = () => {
    if (projects.length > 0 && projects[0].environments.length > 0) {
      return {
        "permission-0": {
          projectId: projects[0].id,
          environmentId: projects[0].environments[0].id,
          permission: ApiKeyPermission.read,
          projectName: projects[0].name,
          environmentType: projects[0].environments[0].type,
        },
      };
    }
    return {} as Record<string, PermissionRecord>;
  };

  // Initialize with one permission by default
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, PermissionRecord>>(() =>
    getInitialPermissions()
  );

  const projectOptions: ProjectOption[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
  }));

  const removePermission = (index: number) => {
    const updatedPermissions = { ...selectedPermissions };
    delete updatedPermissions[`permission-${index}`];
    setSelectedPermissions(updatedPermissions);
  };

  const addPermission = () => {
    const newIndex = Object.keys(selectedPermissions).length;
    if (projects.length > 0 && projects[0].environments.length > 0) {
      const initialPermission = getInitialPermissions()["permission-0"];
      if (initialPermission) {
        setSelectedPermissions({
          ...selectedPermissions,
          [`permission-${newIndex}`]: initialPermission,
        });
      }
    }
  };

  const updatePermission = (key: string, field: string, value: string) => {
    const project = projects.find((p) => p.id === selectedPermissions[key].projectId);
    const environment = project?.environments.find((env) => env.id === value);

    setSelectedPermissions({
      ...selectedPermissions,
      [key]: {
        ...selectedPermissions[key],
        [field]: value,
        ...(field === "environmentId" && environment ? { environmentType: environment.type } : {}),
      },
    });
  };

  // Update environment when project changes
  const updateProjectAndEnvironment = (key: string, projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project && project.environments.length > 0) {
      const environment = project.environments[0];
      setSelectedPermissions({
        ...selectedPermissions,
        [key]: {
          ...selectedPermissions[key],
          projectId,
          environmentId: environment.id,
          projectName: project.name,
          environmentType: environment.type,
        },
      });
    }
  };

  const checkForDuplicatePermissions = () => {
    const permissions = Object.values(selectedPermissions);
    const uniquePermissions = new Set(permissions.map((p) => `${p.projectId}-${p.environmentId}`));
    return uniquePermissions.size !== permissions.length;
  };

  const submitAPIKey = async () => {
    const data = getValues();

    if (checkForDuplicatePermissions()) {
      toast.error(t("environments.project.api_keys.duplicate_access"));
      return;
    }

    // Convert permissions to the format expected by the API
    const environmentPermissions = Object.values(selectedPermissions).map((permission) => ({
      environmentId: permission.environmentId,
      permission: permission.permission,
    }));

    await onSubmit({
      label: data.label,
      environmentPermissions,
      organizationAccess: selectedOrganizationAccess,
    });

    reset();
    setSelectedPermissions(getInitialPermissions());
    setSelectedOrganizationAccess(defaultOrganizationAccess);
  };

  // Get environment options for a project
  const getEnvironmentOptionsForProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.environments || [];
  };

  const isSubmitDisabled = () => {
    // Check if label is empty or only whitespace
    if (!apiKeyLabel?.trim()) {
      return true;
    }
    // Check if there are any valid permissions
    if (Object.keys(selectedPermissions).length === 0) {
      return true;
    }
    return false;
  };

  const setSelectedOrganizationAccessValue = (key: string, accessType: string, value: boolean) => {
    setSelectedOrganizationAccess((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [accessType]: value,
      },
    }));
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={true}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="text-xl font-medium text-slate-700">
                {t("environments.project.api_keys.add_api_key")}
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitAPIKey)}>
          <div className="flex flex-col justify-between rounded-lg p-6">
            <div className="w-full space-y-6">
              <div className="space-y-2">
                <Label>{t("environments.project.api_keys.api_key_label")}</Label>
                <Input
                  placeholder="e.g. GitHub, PostHog, Slack"
                  {...register("label", { required: true, validate: (value) => value.trim() !== "" })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("environments.project.api_keys.project_access")}</Label>
                <div className="space-y-2">
                  {/* Permission rows */}
                  {Object.keys(selectedPermissions).map((key) => {
                    const permissionIndex = parseInt(key.split("-")[1]);
                    const permission = selectedPermissions[key];
                    return (
                      <div key={key} className="flex items-center gap-2">
                        {/* Project dropdown */}
                        <div className="w-1/3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden">
                                <span className="flex w-4/5 flex-1">
                                  <span className="w-full truncate text-left">{permission.projectName}</span>
                                </span>
                                <span className="flex h-full items-center border-l pl-3">
                                  <ChevronDownIcon className="h-4 w-4 text-slate-500" />
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="min-w-[8rem]">
                              {projectOptions.map((option) => (
                                <DropdownMenuItem
                                  key={option.id}
                                  onClick={() => {
                                    updateProjectAndEnvironment(key, option.id);
                                  }}>
                                  {option.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Environment dropdown */}
                        <div className="w-1/3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden">
                                <span className="flex w-4/5 flex-1">
                                  <span className="w-full truncate text-left capitalize">
                                    {permission.environmentType}
                                  </span>
                                </span>
                                <span className="flex h-full items-center border-l pl-3">
                                  <ChevronDownIcon className="h-4 w-4 text-slate-500" />
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="min-w-[8rem] capitalize">
                              {getEnvironmentOptionsForProject(permission.projectId).map((env) => (
                                <DropdownMenuItem
                                  key={env.id}
                                  onClick={() => {
                                    updatePermission(key, "environmentId", env.id);
                                  }}>
                                  {env.type}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Permission level dropdown */}
                        <div className="w-1/3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden">
                                <span className="flex w-4/5 flex-1">
                                  <span className="w-full truncate text-left capitalize">
                                    {permission.permission}
                                  </span>
                                </span>
                                <span className="flex h-full items-center border-l pl-3">
                                  <ChevronDownIcon className="h-4 w-4 text-slate-500" />
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="min-w-[8rem] capitalize">
                              {permissionOptions.map((option) => (
                                <DropdownMenuItem
                                  key={option}
                                  onClick={() => {
                                    updatePermission(key, "permission", option);
                                  }}>
                                  {option}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          className="p-2"
                          onClick={() => removePermission(permissionIndex)}
                          disabled={Object.keys(selectedPermissions).length <= 1}>
                          <Trash2Icon
                            className={`h-5 w-5 ${
                              Object.keys(selectedPermissions).length <= 1
                                ? "text-slate-300"
                                : "text-slate-500 hover:text-red-500"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add permission button */}
                  <Button type="button" variant="outline" onClick={addPermission}>
                    <span className="mr-2">+</span> {t("environments.settings.api_keys.add_permission")}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("environments.project.api_keys.organization_access")}</Label>
                <div className="space-y-2">
                  <div className="grid grid-cols-[auto_100px_100px] gap-4">
                    <div></div>
                    <span className="flex items-center justify-center text-sm font-medium">Read</span>
                    <span className="flex items-center justify-center text-sm font-medium">Write</span>

                    {Object.keys(selectedOrganizationAccess).map((key) => (
                      <Fragment key={key}>
                        <div className="py-1 text-sm">{t(getOrganizationAccessKeyDisplayName(key))}</div>
                        <div className="flex items-center justify-center py-1">
                          <Switch
                            data-testid={`organization-access-${key}-read`}
                            checked={selectedOrganizationAccess[key].read}
                            onCheckedChange={(newVal) =>
                              setSelectedOrganizationAccessValue(key, "read", newVal)
                            }
                          />
                        </div>
                        <div className="flex items-center justify-center py-1">
                          <Switch
                            data-testid={`organization-access-${key}-write`}
                            checked={selectedOrganizationAccess[key].write}
                            onCheckedChange={(newVal) =>
                              setSelectedOrganizationAccessValue(key, "write", newVal)
                            }
                          />
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
              <Alert variant="warning">
                <AlertTitle>{t("environments.project.api_keys.api_key_security_warning")}</AlertTitle>
              </Alert>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  reset();
                  setSelectedPermissions(getInitialPermissions());
                }}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitDisabled() || isCreatingAPIKey}
                loading={isCreatingAPIKey}>
                {t("environments.project.api_keys.add_api_key")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
