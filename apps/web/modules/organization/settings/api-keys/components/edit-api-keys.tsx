"use client";

import { ApiKeyPermission } from "@prisma/client";
import { FilesIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationAccess } from "@formbricks/types/api-key";
import { TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { ViewPermissionModal } from "@/modules/organization/settings/api-keys/components/view-permission-modal";
import {
  TApiKeyUpdateInput,
  TApiKeyWithEnvironmentPermission,
  TOrganizationWorkspace,
} from "@/modules/organization/settings/api-keys/types/api-keys";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { createApiKeyAction, deleteApiKeyAction, updateApiKeyAction } from "../actions";
import { AddApiKeyModal } from "./add-api-key-modal";

const ApiKeyDisplay = ({ apiKey }: Readonly<{ apiKey: string }>) => {
  const { t } = useTranslation();
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      toast.success(t("workspace.api_keys.api_key_copied_to_clipboard"));
    } catch {
      toast.error(t("workspace.api_keys.unable_to_copy_api_key"));
    }
  };

  if (!apiKey) {
    return <span className="italic">{t("workspace.api_keys.secret")}</span>;
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="whitespace-pre-line break-all">{apiKey}</span>
      <div className="copyApiKeyIcon flex-shrink-0">
        <FilesIcon
          className="size-4 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            void copyToClipboard();
          }}
          data-testid="copy-button"
        />
      </div>
    </div>
  );
};

interface EditAPIKeysProps {
  organizationId: string;
  apiKeys: TApiKeyWithEnvironmentPermission[];
  locale: TUserLocale;
  isReadOnly: boolean;
  workspaces: TOrganizationWorkspace[];
}

export const EditAPIKeys = ({
  organizationId,
  apiKeys,
  locale,
  isReadOnly,
  workspaces,
}: EditAPIKeysProps) => {
  const { t } = useTranslation();
  const [isAddAPIKeyModalOpen, setIsAddAPIKeyModalOpen] = useState(false);
  const [isDeleteKeyModalOpen, setIsDeleteKeyModalOpen] = useState(false);
  const [apiKeysLocal, setApiKeysLocal] =
    useState<(TApiKeyWithEnvironmentPermission & { actualKey?: string })[]>(apiKeys);
  const [activeKey, setActiveKey] = useState<TApiKeyWithEnvironmentPermission | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewPermissionsOpen, setViewPermissionsOpen] = useState(false);

  const handleOpenDeleteKeyModal = (e: React.MouseEvent, apiKey: TApiKeyWithEnvironmentPermission) => {
    e.preventDefault();
    setActiveKey(apiKey);
    setIsDeleteKeyModalOpen(true);
  };

  const handleDeleteKey = async () => {
    if (!activeKey) return;
    setIsLoading(true);
    const deleteApiKeyResponse = await deleteApiKeyAction({ id: activeKey.id });
    if (deleteApiKeyResponse?.data) {
      const updatedApiKeys = apiKeysLocal?.filter((apiKey) => apiKey.id !== activeKey.id) || [];
      setApiKeysLocal(updatedApiKeys);
      toast.success(t("workspace.api_keys.api_key_deleted"));
      setIsDeleteKeyModalOpen(false);
      setIsLoading(false);
    } else {
      toast.error(t("workspace.api_keys.unable_to_delete_api_key"));
      setIsDeleteKeyModalOpen(false);
      setIsLoading(false);
    }
  };

  const handleAddAPIKey = async (data: {
    label: string;
    workspacePermissions: Array<{
      permission: ApiKeyPermission;
      workspaceId: string;
    }>;
    organizationAccess: TOrganizationAccess;
  }): Promise<void> => {
    setIsLoading(true);
    const createApiKeyResponse = await createApiKeyAction({
      organizationId: organizationId,
      apiKeyData: {
        label: data.label,
        workspacePermissions: data.workspacePermissions,
        organizationAccess: data.organizationAccess,
      },
    });

    if (createApiKeyResponse?.data) {
      const updatedApiKeys = [...apiKeysLocal, createApiKeyResponse.data];
      setApiKeysLocal(updatedApiKeys);
      setIsLoading(false);
      toast.success(t("workspace.api_keys.api_key_created"));
    } else {
      setIsLoading(false);
      const errorMessage = getFormattedErrorMessage(createApiKeyResponse);
      toast.error(errorMessage);
    }

    setIsAddAPIKeyModalOpen(false);
  };

  const handleUpdateAPIKey = async (data: TApiKeyUpdateInput) => {
    if (!activeKey) return;

    const updateApiKeyResponse = await updateApiKeyAction({
      apiKeyId: activeKey.id,
      apiKeyData: data,
    });

    if (updateApiKeyResponse?.data) {
      const updatedApiKeys =
        apiKeysLocal?.map((apiKey) => {
          if (apiKey.id === activeKey.id) {
            return {
              ...apiKey,
              label: data.label,
            };
          }
          return apiKey;
        }) || [];

      setApiKeysLocal(updatedApiKeys);
      toast.success(t("workspace.api_keys.api_key_updated"));
      setIsLoading(false);
    } else {
      const errorMessage = getFormattedErrorMessage(updateApiKeyResponse);
      toast.error(errorMessage);
      setIsLoading(false);
    }

    setViewPermissionsOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-10 content-center rounded-t-lg bg-slate-100 px-6 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-4 sm:col-span-2">{t("common.label")}</div>
          <div className="col-span-4 hidden sm:col-span-5 sm:block">{t("workspace.api_keys.api_key")}</div>
          <div className="col-span-4 sm:col-span-2">{t("common.created_at")}</div>
          <div></div>
        </div>
        <div className="grid-cols-9">
          {apiKeysLocal?.length === 0 ? (
            <div className="flex h-12 items-center justify-center whitespace-nowrap px-6 text-sm font-medium text-slate-400">
              {t("workspace.api_keys.no_api_keys_yet")}
            </div>
          ) : (
            apiKeysLocal?.map((apiKey) => (
              <div
                role="button"
                className="grid h-12 w-full grid-cols-10 content-center items-center rounded-lg px-6 text-left text-sm text-slate-900 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                onClick={() => {
                  setActiveKey(apiKey);
                  setViewPermissionsOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveKey(apiKey);
                    setViewPermissionsOpen(true);
                  }
                }}
                tabIndex={0}
                data-testid="api-key-row"
                key={apiKey.id}>
                <div className="col-span-4 font-semibold sm:col-span-2">{apiKey.label}</div>
                <div className="col-span-4 hidden pr-4 sm:col-span-5 sm:block">
                  <ApiKeyDisplay apiKey={apiKey.actualKey ?? ""} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  {timeSince(apiKey.createdAt.toString(), locale)}
                </div>
                {!isReadOnly && (
                  <div className="col-span-1 text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        handleOpenDeleteKeyModal(e, apiKey);
                        e.stopPropagation();
                      }}>
                      <TrashIcon />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {!isReadOnly && (
        <div>
          <Button
            size="sm"
            onClick={() => {
              setIsAddAPIKeyModalOpen(true);
            }}>
            {t("workspace.settings.api_keys.add_api_key")}
          </Button>
        </div>
      )}
      <AddApiKeyModal
        open={isAddAPIKeyModalOpen}
        setOpen={setIsAddAPIKeyModalOpen}
        onSubmit={handleAddAPIKey}
        workspaces={workspaces}
        isCreatingAPIKey={isLoading}
      />
      {activeKey && (
        <ViewPermissionModal
          open={viewPermissionsOpen}
          setOpen={setViewPermissionsOpen}
          onSubmit={handleUpdateAPIKey}
          apiKey={activeKey}
          workspaces={workspaces}
          isUpdating={isLoading}
        />
      )}
      <DeleteDialog
        open={isDeleteKeyModalOpen}
        setOpen={setIsDeleteKeyModalOpen}
        deleteWhat={t("workspace.api_keys.api_key")}
        onDelete={handleDeleteKey}
        isDeleting={isLoading}
        text={t("workspace.api_keys.delete_api_key_confirmation")}
      />
    </div>
  );
};
