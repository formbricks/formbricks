"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TOrganizationAccess } from "@formbricks/types/api-key";
import { type TOrganizationWorkspace } from "@/modules/ee/teams/team-list/types/workspace";
import {
  type TApiKeyUpdateInput,
  type TApiKeyWithEnvironmentPermission,
  ZApiKeyUpdateInput,
} from "@/modules/organization/settings/api-keys/types/api-keys";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { DropdownMenu, DropdownMenuTrigger } from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface ViewPermissionModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: TApiKeyUpdateInput) => Promise<void>;
  apiKey: TApiKeyWithEnvironmentPermission;
  workspaces: TOrganizationWorkspace[];
  isUpdating: boolean;
}

export const ViewPermissionModal = ({
  open,
  setOpen,
  onSubmit,
  apiKey,
  workspaces,
  isUpdating,
}: ViewPermissionModalProps) => {
  const { register, getValues, handleSubmit, reset, watch } = useForm<TApiKeyUpdateInput>({
    defaultValues: {
      label: apiKey.label,
    },
    resolver: zodResolver(ZApiKeyUpdateInput),
  });

  useEffect(() => {
    reset({ label: apiKey.label });
  }, [apiKey.label, reset]);

  const apiKeyLabel = watch("label");

  const isSubmitDisabled = () => {
    // Check if label is empty or only whitespace or if the label is the same as the original
    if (!apiKeyLabel?.trim() || apiKeyLabel === apiKey.label) {
      return true;
    }

    return false;
  };

  const { t } = useTranslation();
  const organizationAccess = apiKey.organizationAccess as TOrganizationAccess;
  const workspacePermissions = apiKey.apiKeyWorkspaces ?? [];

  const getWorkspaceName = (workspaceId: string) => {
    return workspaces.find((workspace) => workspace.id === workspaceId)?.name;
  };

  const updateApiKey = async () => {
    const data = getValues();
    await onSubmit(data);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{apiKey.label}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form onSubmit={handleSubmit(updateApiKey)}>
            <div className="w-full space-y-6">
              <div className="space-y-2">
                <Label>{t("workspace.api_keys.api_key_label")}</Label>
                <Input
                  placeholder="e.g. GitHub, PostHog, Slack"
                  data-testid="api-key-label"
                  {...register("label", { required: true, validate: (value) => value.trim() !== "" })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("workspace.api_keys.permissions")}</Label>
                {workspacePermissions.length === 0 && (
                  <div className="text-center text-sm">
                    {t("workspace.api_keys.no_workspace_permissions_found")}
                  </div>
                )}
                <div className="space-y-2">
                  {workspacePermissions.map((permission) => {
                    return (
                      <div key={permission.workspaceId} className="flex items-center gap-2">
                        {/* Workspace dropdown */}
                        <div className="w-1/2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none">
                                <span className="flex w-4/5 flex-1">
                                  <span className="w-full truncate text-left">
                                    {getWorkspaceName(permission.workspaceId)}
                                  </span>
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                          </DropdownMenu>
                        </div>

                        {/* Permission level dropdown */}
                        <div className="w-1/2">
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
              <div className="space-y-4">
                <Label>{t("workspace.api_keys.organization_access")}</Label>
                {Object.keys(organizationAccess).map((key) => (
                  <div key={key} className="mb-2 flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Read</Label>
                      <Switch
                        disabled={true}
                        data-testid={`organization-access-${key}-read`}
                        checked={organizationAccess[key].read || organizationAccess[key].write}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Write</Label>
                      <Switch
                        disabled={true}
                        data-testid={`organization-access-${key}-write`}
                        checked={organizationAccess[key].write}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOpen(false);
              reset();
            }}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitDisabled() || isUpdating}
            loading={isUpdating}
            onClick={handleSubmit(updateApiKey)}>
            {t("common.update")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
