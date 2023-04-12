"use client";

import { timeSince } from "@/../../packages/lib/time";
import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { createApiKey, deleteApiKey, useApiKeys } from "@/lib/apiKeys";
import { capitalizeFirstLetter } from "@/lib/utils";
import { Button, ErrorComponent } from "@formbricks/ui";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import toast from "react-hot-toast";
import AddAPIKeyModal from "./AddApiKeyModal";

export default function EditAPIKeys({
  environmentTypeId,
  environmentType,
}: {
  environmentTypeId: string;
  environmentType: string;
}) {
  const { apiKeys, mutateApiKeys, isLoadingApiKeys, isErrorApiKeys } = useApiKeys(environmentTypeId);

  const [isAddAPIKeyModalOpen, setOpenAddAPIKeyModal] = useState(false);
  const [isDeleteKeyModalOpen, setOpenDeleteKeyModal] = useState(false);

  const [activeKey, setActiveKey] = useState({} as any);

  const handleOpenDeleteKeyModal = (e, apiKey) => {
    e.preventDefault();
    setActiveKey(apiKey);
    setOpenDeleteKeyModal(true);
  };

  const handleDeleteKey = async () => {
    await deleteApiKey(environmentTypeId, activeKey);
    mutateApiKeys();
    setOpenDeleteKeyModal(false);
    toast.success("API Key deleted");
  };

  const handleAddAPIKey = async (data) => {
    const apiKey = await createApiKey(environmentTypeId, { label: data.label });
    mutateApiKeys([...JSON.parse(JSON.stringify(apiKeys)), apiKey], false);
    setOpenAddAPIKeyModal(false);
  };

  if (isLoadingApiKeys) {
    return <LoadingSpinner />;
  }

  if (isErrorApiKeys) {
    <ErrorComponent />;
  }

  return (
    <>
      <div className="mb-6 text-right">
        <Button
          variant="primary"
          onClick={() => {
            setOpenAddAPIKeyModal(true);
          }}>
          {`Add ${capitalizeFirstLetter(environmentType)} API Key`}
        </Button>
      </div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-9 content-center rounded-t-lg bg-slate-100 px-6 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-2">Label</div>
          <div className="col-span-2">API Key</div>
          <div className="col-span-2">Last used</div>
          <div className="col-span-2">Created at</div>
          <div className=""></div>
        </div>
        <div className="grid-cols-9">
          {apiKeys.length === 0 ? (
            <div className="flex h-12 items-center justify-center whitespace-nowrap px-6 text-sm font-medium text-slate-400 ">
              You don&apos;t have any API keys yet
            </div>
          ) : (
            apiKeys.map((apiKey) => (
              <div
                className="grid h-12 w-full grid-cols-9 content-center rounded-lg px-6 text-left text-sm text-slate-900"
                key={apiKey.hashedKey}>
                <div className="col-span-2 font-semibold">{apiKey.label}</div>
                <div className="col-span-2">{apiKey.apiKey || <span className="italic">secret</span>}</div>
                <div className="col-span-2">{apiKey.lastUsed && timeSince(apiKey.lastUsed)}</div>
                <div className="col-span-2">{timeSince(apiKey.createdAt)}</div>
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
