"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import Modal from "@/components/Modal";
import { createApiKey, deleteApiKey, useApiKeys } from "@/lib/apiKeys";
import { convertDateTimeString } from "@/lib/utils";
import { Button } from "@formbricks/ui";
import { useState } from "react";

export default function ProfileSettingsPage() {
  const { apiKeys, mutateApiKeys, isLoadingApiKeys } = useApiKeys();
  const [openNewApiKeyModal, setOpenNewApiKeyModal] = useState(false);

  return (
    <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900">Account Settings</h1>
      </header>
      {/* Payment details */}
      <div className="space-y-6 sm:px-6 lg:col-span-9 lg:px-0">
        <section aria-labelledby="payment-details-heading">
          <div className="shadow sm:overflow-hidden sm:rounded-md">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="sm:flex sm:items-center">
                <div className="mt-6 sm:flex-auto">
                  <h1 className="text-xl font-semibold text-slate-900">Personal API Keys</h1>
                  <p className="mt-2 text-sm text-slate-700">
                    These keys allow full access to your personal account through the API, as if you were
                    logged in. Try not to keep disused keys around. If you have any suspicion that one of
                    these may be compromised, delete it and use a new one.
                  </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                  <Button onClick={() => setOpenNewApiKeyModal(true)}>Add API Key</Button>
                </div>
              </div>

              <div className="mt-8 flex flex-col">
                <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                  <div className="inline-block min-w-full py-2 align-middle">
                    <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5">
                      <table className="min-w-full divide-y divide-slate-300">
                        <thead className="bg-slate-50">
                          <tr>
                            <th
                              scope="col"
                              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6 lg:pl-8">
                              Label
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                              Value
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                              Last Used
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                              Created
                            </th>
                            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 lg:pr-8">
                              <span className="sr-only">Edit</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {isLoadingApiKeys ? (
                            <LoadingSpinner />
                          ) : apiKeys.length === 0 ? (
                            <tr>
                              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6 lg:pl-8">
                                You don&apos;t have any API Keys yet
                              </td>
                            </tr>
                          ) : (
                            apiKeys.map((apiKey) => (
                              <tr key={apiKey.hashedKey}>
                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6 lg:pl-8">
                                  {apiKey.label}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                  {apiKey.apiKey || <span className="italic">secret</span>}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                  {convertDateTimeString(apiKey.lastUsed)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                                  {convertDateTimeString(apiKey.createdAt)}
                                </td>
                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 lg:pr-8">
                                  <button
                                    onClick={async () => {
                                      if (
                                        confirm(
                                          "Do you really want to delete this API Key? It can no longer be used to access the API and cannot be restored."
                                        )
                                      ) {
                                        await deleteApiKey(apiKey);
                                        mutateApiKeys();
                                      }
                                    }}
                                    className="text-brand-dark hover:text-brand">
                                    Delete<span className="sr-only">, {apiKey.label}</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      {openNewApiKeyModal && (
        <Modal open={openNewApiKeyModal} setOpen={setOpenNewApiKeyModal}>
          <div className="w-full">
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">
              Create new Personal API Key
            </h2>
            <hr className="my-4 w-full text-slate-400" />
            <form
              onSubmit={async (e: any) => {
                e.preventDefault();
                const apiKey = await createApiKey({ label: e.target.label.value });
                mutateApiKeys([...JSON.parse(JSON.stringify(apiKeys)), apiKey], false);
                setOpenNewApiKeyModal(false);
              }}>
              <div>
                <label htmlFor="label" className="block text-sm font-medium text-slate-700">
                  Label
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="label"
                    id="label"
                    className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="e.g. Github"
                  />
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-800">
                The API key will only be shown once. Copy it to your destination right away.
              </p>
              <div className="mt-4 flex w-full justify-end">
                <Button variant="secondary" className="mr-2">
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
