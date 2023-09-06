"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import { capitalizeFirstLetter } from "@/lib/utils";
import { timeSince } from "@formbricks/lib/time";
import { TApiKey } from "@formbricks/types/v1/apiKeys";
import { Button } from "@formbricks/ui";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import toast from "react-hot-toast";
import AddAPIKeyModal from "./AddApiKeyModal";
import { createApiKeyAction, deleteApiKeyAction } from "./actions";

export default function EditAPIKeys({
  environmentTypeId,
  environmentType,
  apiKeys,
  environmentId,
}: {
  environmentTypeId: string;
  environmentType: string;
  apiKeys: TApiKey[];
  environmentId: string;
}) {
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
    await deleteApiKeyAction(activeKey.id);
    const updatedApiKeys = apiKeysLocal?.filter((apiKey) => apiKey.id !== activeKey.id) || [];
    setApiKeysLocal(updatedApiKeys);
    setOpenDeleteKeyModal(false);
    toast.success("API Key deleted");
  };

  const handleAddAPIKey = async (data) => {
    const apiKey = await createApiKeyAction(environmentTypeId, { label: data.label });
    const updatedApiKeys = [...apiKeysLocal!, apiKey];
    setApiKeysLocal(updatedApiKeys);
    setOpenAddAPIKeyModal(false);
    toast.success("API key created");
  };

  return (
    <>
      <div className="mb-6 text-right">
        <Button
          variant="darkCTA"
          disabled={environmentId !== environmentTypeId}
          onClick={() => {
            setOpenAddAPIKeyModal(true);
          }}>
          {`Add ${capitalizeFirstLetter(environmentType)} API Key`}
        </Button>
      </div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-9 content-center rounded-t-lg bg-slate-100 px-6 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-4 sm:col-span-2">Label</div>
          <div className="col-span-4 hidden sm:col-span-2 sm:block">API Key</div>
          <div className="col-span-4 hidden sm:col-span-2 sm:block">Last used</div>
          <div className="col-span-4 sm:col-span-2">Created at</div>
          <div className=""></div>
        </div>
        <div className="grid-cols-9">
          {apiKeysLocal && apiKeysLocal.length === 0 ? (
            <div className="flex h-12 items-center justify-center whitespace-nowrap px-6 text-sm font-medium text-slate-400 ">
              You don&apos;t have any API keys yet
            </div>
          ) : (
            apiKeysLocal &&
            apiKeysLocal.map((apiKey) => (
              <div
                className="grid h-12 w-full grid-cols-9 content-center rounded-lg px-6 text-left text-sm text-slate-900"
                key={apiKey.hashedKey}>
                <div className="col-span-4 font-semibold sm:col-span-2">{apiKey.label}</div>
                <div className="col-span-4 hidden sm:col-span-2 sm:block">
                  {apiKey.apiKey || <span className="italic">secret</span>}
                </div>
                <div className="col-span-4 hidden sm:col-span-2 sm:block">
                  {apiKey.lastUsedAt && timeSince(apiKey.lastUsedAt.toString())}
                </div>
                <div className="col-span-4 sm:col-span-2">{timeSince(apiKey.createdAt.toString())}</div>
                <div className="col-span-1 text-center">
                  <button onClick={(e) => handleOpenDeleteKeyModal(e, apiKey)}>
                    <TrashIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AddAPIKeyModal
        open={isAddAPIKeyModalOpen}
        setOpen={setOpenAddAPIKeyModal}
        onSubmit={handleAddAPIKey}
      />
      <DeleteDialog
        open={isDeleteKeyModalOpen}
        setOpen={setOpenDeleteKeyModal}
        deleteWhat="API Key"
        onDelete={handleDeleteKey}
      />
    </>
  );
}
