"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { TApiKey } from "@/modules/projects/settings/api-keys/types/api-keys";
import { Button } from "@/modules/ui/components/button";
import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { useTranslate } from "@tolgee/react";
import { FilesIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { timeSince } from "@formbricks/lib/time";
import { TUserLocale } from "@formbricks/types/user";
import { createApiKeyAction, deleteApiKeyAction } from "../actions";
import { AddApiKeyModal } from "./add-api-key-modal";

interface EditAPIKeysProps {
  environmentTypeId: string;
  environmentType: string;
  apiKeys: TApiKey[];
  environmentId: string;
  locale: TUserLocale;
  isReadOnly: boolean;
}

export const EditAPIKeys = ({
  environmentTypeId,
  environmentType,
  apiKeys,
  environmentId,
  locale,
  isReadOnly,
}: EditAPIKeysProps) => {
  const { t } = useTranslate();
  const [isAddAPIKeyModalOpen, setOpenAddAPIKeyModal] = useState(false);
  const [isDeleteKeyModalOpen, setOpenDeleteKeyModal] = useState(false);
  const [apiKeysLocal, setApiKeysLocal] = useState<TApiKey[]>(apiKeys);
  const [activeKey, setActiveKey] = useState({} as any);

  const handleOpenDeleteKeyModal = (e, apiKey) => {
    e.preventDefault();
    setActiveKey(apiKey);
    setOpenDeleteKeyModal(true);
  };

  const handleDeleteKey = async () => {
    try {
      await deleteApiKeyAction({ id: activeKey.id });
      const updatedApiKeys = apiKeysLocal?.filter((apiKey) => apiKey.id !== activeKey.id) || [];
      setApiKeysLocal(updatedApiKeys);
      toast.success(t("environments.project.api-keys.api_key_deleted"));
    } catch (e) {
      toast.error(t("environments.project.api-keys.unable_to_delete_api_key"));
    } finally {
      setOpenDeleteKeyModal(false);
    }
  };

  const handleAddAPIKey = async (data) => {
    const createApiKeyResponse = await createApiKeyAction({
      environmentId: environmentTypeId,
      apiKeyData: { label: data.label },
    });
    if (createApiKeyResponse?.data) {
      const updatedApiKeys = [...apiKeysLocal!, createApiKeyResponse.data];
      setApiKeysLocal(updatedApiKeys);
      toast.success(t("environments.project.api-keys.api_key_created"));
    } else {
      const errorMessage = getFormattedErrorMessage(createApiKeyResponse);
      toast.error(errorMessage);
    }

    setOpenAddAPIKeyModal(false);
  };

  const ApiKeyDisplay = ({ apiKey }) => {
    const copyToClipboard = () => {
      navigator.clipboard.writeText(apiKey);
      toast.success(t("environments.project.api-keys.api_key_copied_to_clipboard"));
    };

    if (!apiKey) {
      return <span className="italic">{t("environments.project.api-keys.secret")}</span>;
    }

    return (
      <div className="flex items-center">
        <span>{apiKey}</span>
        <div className="copyApiKeyIcon">
          <FilesIcon className="mx-2 h-4 w-4 cursor-pointer" onClick={copyToClipboard} />
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
            {t("environments.project.api-keys.api_key")}
          </div>
          <div className="col-span-4 sm:col-span-2">{t("common.created_at")}</div>
          <div></div>
        </div>
        <div className="grid-cols-9">
          {apiKeysLocal && apiKeysLocal.length === 0 ? (
            <div className="flex h-12 items-center justify-center whitespace-nowrap px-6 text-sm font-medium text-slate-400">
              {t("environments.project.api-keys.no_api_keys_yet")}
            </div>
          ) : (
            apiKeysLocal &&
            apiKeysLocal.map((apiKey) => (
              <div
                className="grid h-12 w-full grid-cols-10 content-center items-center rounded-lg px-6 text-left text-sm text-slate-900"
                key={apiKey.hashedKey}>
                <div className="col-span-4 font-semibold sm:col-span-2">{apiKey.label}</div>
                <div className="col-span-4 hidden sm:col-span-5 sm:block">
                  <ApiKeyDisplay apiKey={apiKey.apiKey} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  {timeSince(apiKey.createdAt.toString(), locale)}
                </div>
                {!isReadOnly && (
                  <div className="col-span-1 text-center">
                    <Button size="icon" variant="ghost" onClick={(e) => handleOpenDeleteKeyModal(e, apiKey)}>
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
            disabled={environmentId !== environmentTypeId}
            onClick={() => {
              setOpenAddAPIKeyModal(true);
            }}>
            {t("environments.project.api-keys.add_env_api_key", { environmentType })}
          </Button>
        </div>
      )}
      <AddApiKeyModal
        open={isAddAPIKeyModalOpen}
        setOpen={setOpenAddAPIKeyModal}
        onSubmit={handleAddAPIKey}
      />
      <DeleteDialog
        open={isDeleteKeyModalOpen}
        setOpen={setOpenDeleteKeyModal}
        deleteWhat={t("environments.project.api-keys.api_key")}
        onDelete={handleDeleteKey}
      />
    </div>
  );
};
