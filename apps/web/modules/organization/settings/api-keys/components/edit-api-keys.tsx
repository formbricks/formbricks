"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { ViewPermissionModal } from "@/modules/organization/settings/api-keys/components/view-permission-modal";
import {
  TApiKeyWithEnvironmentPermission,
  TOrganizationProject,
} from "@/modules/organization/settings/api-keys/types/api-keys";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { ApiKey, ApiKeyPermission } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { FilesIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { timeSince } from "@formbricks/lib/time";
import { TUserLocale } from "@formbricks/types/user";
import { createApiKeyAction, deleteApiKeyAction } from "../actions";
import { AddApiKeyModal } from "./add-api-key-modal";

interface EditAPIKeysProps {
  organizationId: string;
  apiKeys: TApiKeyWithEnvironmentPermission[];
  locale: TUserLocale;
  isReadOnly: boolean;
  projects: TOrganizationProject[];
}

export const EditAPIKeys = ({ organizationId, apiKeys, locale, isReadOnly, projects }: EditAPIKeysProps) => {
  const { t } = useTranslate();
  const [isAddAPIKeyModalOpen, setIsAddAPIKeyModalOpen] = useState(false);
  const [isDeleteKeyModalOpen, setIsDeleteKeyModalOpen] = useState(false);
  const [apiKeysLocal, setApiKeysLocal] = useState<(ApiKey & { actualKey?: string })[]>(apiKeys);
  const [activeKey, setActiveKey] = useState({} as any);
  const [isCreatingAPIKey, setIsCreatingAPIKey] = useState(false);
  const [viewPermissionsOpen, setViewPermissionsOpen] = useState(false);

  const handleOpenDeleteKeyModal = (e, apiKey) => {
    e.preventDefault();
    setActiveKey(apiKey);
    setIsDeleteKeyModalOpen(true);
  };

  const handleDeleteKey = async () => {
    const deleteApiKeyResponse = await deleteApiKeyAction({ id: activeKey.id });
    if (deleteApiKeyResponse?.data) {
      const updatedApiKeys = apiKeysLocal?.filter((apiKey) => apiKey.id !== activeKey.id) || [];
      setApiKeysLocal(updatedApiKeys);
      toast.success(t("environments.project.api_keys.api_key_deleted"));
      setIsDeleteKeyModalOpen(false);
    } else {
      toast.error(t("environments.project.api_keys.unable_to_delete_api_key"));
      setIsDeleteKeyModalOpen(false);
    }
  };

  const handleAddAPIKey = async (data: {
    label: string;
    environmentPermissions: Array<{ environmentId: string; permission: ApiKeyPermission }>;
  }) => {
    setIsCreatingAPIKey(true);
    const createApiKeyResponse = await createApiKeyAction({
      organizationId: organizationId,
      apiKeyData: {
        label: data.label,
        environmentPermissions: data.environmentPermissions,
      },
    });

    if (createApiKeyResponse?.data) {
      const updatedApiKeys = [...apiKeysLocal, createApiKeyResponse.data];
      setApiKeysLocal(updatedApiKeys);
      setIsCreatingAPIKey(false);
      toast.success(t("environments.project.api_keys.api_key_created"));
    } else {
      setIsCreatingAPIKey(false);
      const errorMessage = getFormattedErrorMessage(createApiKeyResponse);
      toast.error(errorMessage);
    }

    setIsAddAPIKeyModalOpen(false);
  };

  const ApiKeyDisplay = ({ apiKey }) => {
    const copyToClipboard = () => {
      navigator.clipboard.writeText(apiKey);
      toast.success(t("environments.project.api_keys.api_key_copied_to_clipboard"));
    };

    if (!apiKey) {
      return <span className="italic">{t("environments.project.api_keys.secret")}</span>;
    }

    return (
      <div className="flex items-center">
        <span>{apiKey}</span>
        <div className="copyApiKeyIcon">
          <FilesIcon
            className="mx-2 h-4 w-4 cursor-pointer"
            onClick={copyToClipboard}
            data-testid="copy-button"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-10 content-center rounded-t-lg bg-slate-100 px-6 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-4 sm:col-span-2">{t("common.label")}</div>
          <div className="col-span-4 hidden sm:col-span-5 sm:block">
            {t("environments.project.api_keys.api_key")}
          </div>
          <div className="col-span-4 sm:col-span-2">{t("common.created_at")}</div>
          <div></div>
        </div>
        <div className="grid-cols-9">
          {apiKeysLocal?.length === 0 ? (
            <div className="flex h-12 items-center justify-center whitespace-nowrap px-6 text-sm font-medium text-slate-400">
              {t("environments.project.api_keys.no_api_keys_yet")}
            </div>
          ) : (
            apiKeysLocal?.map((apiKey) => (
              <div
                className="grid h-12 w-full cursor-pointer grid-cols-10 content-center items-center rounded-lg px-6 text-left text-sm text-slate-900"
                onClick={() => {
                  setActiveKey(apiKey);
                  setViewPermissionsOpen(true);
                }}
                key={apiKey.hashedKey}>
                <div className="col-span-4 font-semibold sm:col-span-2">{apiKey.label}</div>
                <div className="col-span-4 hidden sm:col-span-5 sm:block">
                  <ApiKeyDisplay apiKey={apiKey.actualKey} />
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
            {t("environments.settings.api_keys.add_api_key")}
          </Button>
        </div>
      )}
      <AddApiKeyModal
        open={isAddAPIKeyModalOpen}
        setOpen={setIsAddAPIKeyModalOpen}
        onSubmit={handleAddAPIKey}
        projects={projects}
        isCreatingAPIKey={isCreatingAPIKey}
      />
      <ViewPermissionModal
        open={viewPermissionsOpen}
        setOpen={setViewPermissionsOpen}
        apiKey={activeKey}
        projects={projects}
      />
      <DeleteDialog
        open={isDeleteKeyModalOpen}
        setOpen={setIsDeleteKeyModalOpen}
        deleteWhat={t("environments.project.api_keys.api_key")}
        onDelete={handleDeleteKey}
      />
    </div>
  );
};
