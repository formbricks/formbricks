"use client";

import { FilesIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

import { capitalizeFirstLetter } from "@formbricks/lib/strings";
import { timeSince } from "@formbricks/lib/time";
import { TApiKey } from "@formbricks/types/apiKeys";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";

import { createApiKeyAction, deleteApiKeyAction } from "../actions";
import AddAPIKeyModal from "./AddApiKeyModal";

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
    try {
      await deleteApiKeyAction(activeKey.id);
      const updatedApiKeys = apiKeysLocal?.filter((apiKey) => apiKey.id !== activeKey.id) || [];
      setApiKeysLocal(updatedApiKeys);
      toast.success("API Key deleted");
    } catch (e) {
      toast.error("Unable to delete API Key");
    } finally {
      setOpenDeleteKeyModal(false);
    }
  };

  const handleAddAPIKey = async (data) => {
    try {
      const apiKey = await createApiKeyAction(environmentTypeId, { label: data.label });
      const updatedApiKeys = [...apiKeysLocal!, apiKey];
      setApiKeysLocal(updatedApiKeys);
      toast.success("API key created");
    } catch (e) {
      toast.error("Unable to create API Key");
    } finally {
      setOpenAddAPIKeyModal(false);
    }
  };

  const ApiKeyDisplay = ({ apiKey }) => {
    const copyToClipboard = () => {
      navigator.clipboard.writeText(apiKey);
      toast.success("API Key copied to clipboard");
    };

    if (!apiKey) {
      return <span className="italic">secret</span>;
    }

    return (
      <div className="flex items-center">
        <span>{apiKey}</span>
        <FilesIcon className="mx-2 h-4 w-4 cursor-pointer" onClick={copyToClipboard} />
      </div>
    );
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
        <div className="grid h-12 grid-cols-10 content-center rounded-t-lg bg-slate-100 px-6 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-4 sm:col-span-2">Label</div>
          <div className="col-span-4 hidden sm:col-span-5 sm:block">API Key</div>
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
                className="grid h-12 w-full grid-cols-10 content-center rounded-lg px-6 text-left text-sm text-slate-900"
                key={apiKey.hashedKey}>
                <div className="col-span-4 font-semibold sm:col-span-2">{apiKey.label}</div>
                <div className="col-span-4 hidden sm:col-span-5 sm:block">
                  <ApiKeyDisplay apiKey={apiKey.apiKey} />
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
