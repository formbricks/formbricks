"use client";

import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { ApiKeyPermission } from "@formbricks/database/prisma-browser";
import { TOrganizationAccess } from "@formbricks/types/api-key";
import { TOrganizationWorkspace } from "@/modules/organization/settings/api-keys/types/api-keys";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface AddApiKeyModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: {
    label: string;
    workspacePermissions: Array<{
      permission: ApiKeyPermission;
      workspaceId: string;
    }>;
    organizationAccess: TOrganizationAccess;
  }) => Promise<void>;
  workspaces: TOrganizationWorkspace[];
  isCreatingAPIKey: boolean;
  isFormbricksCloud: boolean;
}

interface WorkspaceOption {
  id: string;
  name: string;
}

interface PermissionRecord {
  workspaceId: string;
  permission: ApiKeyPermission;
  workspaceName: string;
}

const permissionOptions = [ApiKeyPermission.read, ApiKeyPermission.write, ApiKeyPermission.manage];

export const AddApiKeyModal = ({
  open,
  setOpen,
  onSubmit,
  workspaces,
  isCreatingAPIKey,
  isFormbricksCloud,
}: AddApiKeyModalProps) => {
  const { t } = useTranslation();
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

  const getInitialPermissions = (): Record<string, PermissionRecord> => {
    if (workspaces.length > 0) {
      return {
        "permission-0": {
          workspaceId: workspaces[0].id,
          permission: ApiKeyPermission.read,
          workspaceName: workspaces[0].name,
        },
      };
    }
    return {};
  };

  // Initialize with one permission by default
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, PermissionRecord>>({});

  const workspaceOptions: WorkspaceOption[] = workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
  }));

  const removePermission = (index: number) => {
    const updatedPermissions = { ...selectedPermissions };
    delete updatedPermissions[`permission-${index}`];
    setSelectedPermissions(updatedPermissions);
  };

  const addPermission = () => {
    const newIndex = Object.keys(selectedPermissions).length;
    const initialPermission = getInitialPermissions()["permission-0"];
    if (initialPermission) {
      setSelectedPermissions({
        ...selectedPermissions,
        [`permission-${newIndex}`]: initialPermission,
      });
    }
  };

  const updatePermission = (key: string, field: string, value: string) => {
    setSelectedPermissions({
      ...selectedPermissions,
      [key]: {
        ...selectedPermissions[key],
        [field]: value,
      },
    });
  };

  // Update workspace selection
  const updateWorkspaceSelection = (key: string, workspaceId: string) => {
    const workspace = workspaces.find((p) => p.id === workspaceId);
    if (workspace) {
      setSelectedPermissions({
        ...selectedPermissions,
        [key]: {
          ...selectedPermissions[key],
          workspaceId,
          workspaceName: workspace.name,
        },
      });
    }
  };

  const checkForDuplicatePermissions = () => {
    const permissions = Object.values(selectedPermissions);
    const uniquePermissions = new Set(permissions.map((p) => p.workspaceId));
    return uniquePermissions.size !== permissions.length;
  };

  const submitAPIKey = async () => {
    const data = getValues();

    if (checkForDuplicatePermissions()) {
      toast.error(t("workspace.api_keys.duplicate_access"));
      return;
    }

    // Convert permissions to the format expected by the API
    const workspacePermissions = Object.values(selectedPermissions).map((permission) => ({
      permission: permission.permission,
      workspaceId: permission.workspaceId,
    }));

    await onSubmit({
      label: data.label,
      workspacePermissions,
      organizationAccess: selectedOrganizationAccess,
    });

    reset();
    setSelectedPermissions({});
    setSelectedOrganizationAccess(defaultOrganizationAccess);
  };

  const isSubmitDisabled = () => {
    // Check if label is empty or only whitespace
    if (!apiKeyLabel?.trim()) {
      return true;
    }

    // Check if at least one workspace permission is set or one organization access toggle is ON
    const hasWorkspaceAccess = Object.keys(selectedPermissions).length > 0;

    const hasOrganizationAccess = Object.values(selectedOrganizationAccess).some((accessGroup) =>
      Object.values(accessGroup).some((value) => value === true)
    );

    // Disable submit if no access rights are granted
    return !(hasWorkspaceAccess || hasOrganizationAccess);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="px-1">{t("workspace.api_keys.add_api_key")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(submitAPIKey)} className="contents">
          <DialogBody className="space-y-4 overflow-y-auto px-1 py-4">
            <div className="space-y-2">
              <Label>{t("workspace.api_keys.api_key_label")}</Label>
              <Input
                placeholder="e.g. GitHub, PostHog, Slack"
                {...register("label", { required: true, validate: (value) => value.trim() !== "" })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("workspace.api_keys.workspace_access")}</Label>
              <p className="text-sm text-slate-500">{t("workspace.api_keys.workspace_access_description")}</p>
              <div className="space-y-2">
                {Object.keys(selectedPermissions).length === 0 && (
                  <p className="text-sm text-slate-500">{t("workspace.api_keys.workspace_access_empty")}</p>
                )}
                {/* Permission rows */}
                {Object.keys(selectedPermissions).map((key) => {
                  const permissionIndex = parseInt(key.split("-")[1]);
                  const permission = selectedPermissions[key];
                  return (
                    <div key={key} className="flex items-center gap-2">
                      {/* Workspace dropdown */}
                      <div className="w-1/2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden">
                              <span className="flex w-4/5 flex-1">
                                <span className="w-full truncate text-left">{permission.workspaceName}</span>
                              </span>
                              <span className="flex h-full items-center border-l pl-3">
                                <ChevronDownIcon className="size-4 text-slate-500" />
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="max-h-[300px] min-w-32 overflow-y-auto">
                            {workspaceOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.id}
                                onClick={() => {
                                  updateWorkspaceSelection(key, option.id);
                                }}>
                                {option.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Permission level dropdown */}
                      <div className="w-1/2">
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
                                <ChevronDownIcon className="size-4 text-slate-500" />
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="min-w-32 capitalize">
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
                      <button type="button" className="p-2" onClick={() => removePermission(permissionIndex)}>
                        <Trash2Icon className={"size-5 text-slate-500 hover:text-red-500"} />
                      </button>
                    </div>
                  );
                })}

                {/* Add permission button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPermission}
                  id="add_permission__button"
                  data-testid="add_permission__button__test">
                  <span className="mr-2">+</span> {t("workspace.settings.api_keys.add_permission")}
                </Button>
              </div>
            </div>

            <div className="border-t border-slate-200" />

            <div className="space-y-2">
              <Label>{t("workspace.api_keys.organization_access")}</Label>
              <p className="text-sm text-slate-500">
                {t("workspace.api_keys.organization_access_description")}
              </p>
              {Object.keys(selectedOrganizationAccess).map((key) => (
                <div key={key} className="mt-2 flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Label>Read</Label>
                    <Switch
                      data-testid={`organization-access-${key}-read`}
                      checked={selectedOrganizationAccess[key].read || selectedOrganizationAccess[key].write}
                      onCheckedChange={(newVal) => setSelectedOrganizationAccessValue(key, "read", newVal)}
                      disabled={selectedOrganizationAccess[key].write}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Write</Label>
                    <Switch
                      data-testid={`organization-access-${key}-write`}
                      checked={selectedOrganizationAccess[key].write}
                      onCheckedChange={(newVal) => setSelectedOrganizationAccessValue(key, "write", newVal)}
                    />
                  </div>
                </div>
              ))}
              {isFormbricksCloud && (
                <Alert variant="info" role="status">
                  <AlertDescription>
                    {t("workspace.api_keys.organization_access_cloud_note")}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <Alert variant="warning" role="status">
              <AlertTitle>{t("workspace.api_keys.api_key_security_warning")}</AlertTitle>
            </Alert>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                reset();
                setSelectedPermissions({});
              }}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitDisabled() || isCreatingAPIKey}
              loading={isCreatingAPIKey}>
              {t("workspace.api_keys.add_api_key")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
