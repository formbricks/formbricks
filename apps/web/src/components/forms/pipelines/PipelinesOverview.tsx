"use client";

import EmptyPageFiller from "@/components/EmptyPageFiller";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { deletePipeline, persistPipeline, usePipelines } from "@/lib/pipelines";
import { Button } from "@formbricks/ui";
import { Switch } from "@headlessui/react";
import { BoltIcon, Cog6ToothIcon, TrashIcon } from "@heroicons/react/20/solid";
import { CodeBracketSquareIcon, ShareIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useRouter } from "next/router";
import { useState } from "react";
import { AiOutlineMail } from "react-icons/ai";
import { SiAirtable, SiGoogle, SiNotion, SiSlack, SiZapier } from "react-icons/si";
import AddPipelineModal from "./AddPipelineModal";
import UpdatePipelineModal from "./UpdatePipelineModal";

const integrations = [
  {
    id: "webhook",
    name: "Webhook",
    href: "#",
    comingSoon: false,
    bgColor: "bg-slate-500",
    icon: CodeBracketSquareIcon,
    action: () => {},
  },
  {
    id: "email notification",
    name: "Email Notification",
    href: "#",
    comingSoon: false,
    bgColor: "bg-slate-500",
    icon: AiOutlineMail,
    action: () => {},
  },
  {
    id: "slack",
    name: "Slack Notification",
    comingSoon: false,
    href: "#",
    bgColor: "bg-slate-500",
    icon: SiSlack,
    action: () => {},
  },
  {
    id: "Notion",
    name: "Notion",
    comingSoon: true,
    href: "#",
    bgColor: "bg-slate-500",
    icon: SiNotion,
    action: () => {},
  },
  {
    id: "googleSheets",
    name: "Google Sheets",
    comingSoon: true,
    href: "#",
    bgColor: "bg-slate-500",
    icon: SiGoogle,
    action: () => {},
  },
  {
    id: "zapier",
    name: "Zapier",
    comingSoon: true,
    href: "#",
    bgColor: "bg-slate-500",
    icon: SiZapier,
    action: () => {},
  },
  {
    id: "airtable",
    name: "Airtable",
    comingSoon: true,
    href: "#",
    bgColor: "bg-slate-500",
    icon: SiAirtable,
    action: () => {},
  },
];

export default function PipelinesOverview({}) {
  const router = useRouter();
  const { form, isLoadingForm, isErrorForm } = useForm(
    router.query.formId?.toString(),
    router.query.organisationId?.toString()
  );
  const { pipelines, isLoadingPipelines, isErrorPipelines, mutatePipelines } = usePipelines(
    router.query.formId?.toString(),
    router.query.organisationId?.toString()
  );

  const [openAddModal, setOpenAddModal] = useState(false);
  const [updatePipelineId, setUpdatePipelineId] = useState(null);
  const [openUpdateModal, setOpenUpdateModal] = useState(false);

  const toggleEnabled = async (pipeline) => {
    const newPipeline = JSON.parse(JSON.stringify(pipeline));
    newPipeline.enabled = !newPipeline.enabled;
    await persistPipeline(router.query.formId, router.query.organisationId, newPipeline);
    const pipelineIdx = pipelines.findIndex((p) => p.id === pipeline.id);
    if (pipelineIdx !== -1) {
      const newPipelines = JSON.parse(JSON.stringify(pipelines));
      newPipelines[pipelineIdx] = newPipeline;
      mutatePipelines(newPipelines);
    }
  };

  const openSettings = (pipeline) => {
    setUpdatePipelineId(pipeline.id);
    setOpenUpdateModal(true);
  };

  const deletePipelineAction = async (pipelineId) => {
    await deletePipeline(
      router.query.formId?.toString(),
      router.query.organisationId?.toString(),
      pipelineId
    );
    const newPipelines = JSON.parse(JSON.stringify(pipelines));
    const pipelineIdx = newPipelines.findIndex((p) => p.id === pipelineId);
    if (pipelineIdx > -1) {
      newPipelines.splice(pipelineIdx, 1);
      mutatePipelines(newPipelines);
    }
  };

  if (isLoadingForm || isLoadingPipelines) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorForm || isErrorPipelines) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div className="mx-auto py-8">
      <header className="mb-8">
        <div className="flex justify-between">
          <p className="text-slate-800">
            Pipe your data to third party tools. Setup email notifications for new submissions.
          </p>
          <Button onClick={() => setOpenAddModal(true)}>Add Pipeline</Button>
        </div>
      </header>
      {pipelines.length > 0 ? (
        <>
          <div className="overflow-hidden bg-white shadow sm:rounded-md">
            <ul role="list" className="divide-y divide-gray-200">
              {pipelines.map((pipeline) => (
                <li key={pipeline.id}>
                  <div className="block">
                    <div className="flex items-center px-4 py-4 sm:px-6">
                      <div className="flex min-w-0 flex-1 items-center">
                        <div className="min-w-0 flex-1 px-4 md:grid md:grid-cols-2 md:gap-4">
                          <div>
                            <p className="truncate text-sm font-medium text-slate-800">{pipeline.label}</p>
                            <p className="mt-2 flex items-center text-sm text-gray-500">
                              <BoltIcon
                                className="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400"
                                aria-hidden="true"
                              />
                              <span className="truncate">{pipeline.type}</span>
                            </p>
                          </div>
                          <div className="hidden md:block">
                            <div>
                              {<p className="mb-1 text-xs text-slate-800">Active</p>}
                              <Switch
                                checked={pipeline.enabled}
                                onChange={() => toggleEnabled(pipeline)}
                                className={clsx(
                                  pipeline.enabled ? "bg-brand-dark" : "bg-gray-200",
                                  "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                                )}>
                                <span className="sr-only">Use setting</span>
                                <span
                                  className={clsx(
                                    pipeline.enabled ? "translate-x-5" : "translate-x-0",
                                    "pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                                  )}>
                                  <span
                                    className={clsx(
                                      pipeline.enabled
                                        ? "opacity-0 duration-100 ease-out"
                                        : "opacity-100 duration-200 ease-in",
                                      "absolute inset-0 flex h-full w-full items-center justify-center transition-opacity"
                                    )}
                                    aria-hidden="true">
                                    <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 12 12">
                                      <path
                                        d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </span>
                                  <span
                                    className={clsx(
                                      pipeline.enabled
                                        ? "opacity-100 duration-200 ease-in"
                                        : "opacity-0 duration-100 ease-out",
                                      "absolute inset-0 flex h-full w-full items-center justify-center transition-opacity"
                                    )}
                                    aria-hidden="true">
                                    <svg
                                      className="text-brand-dark h-3 w-3"
                                      fill="currentColor"
                                      viewBox="0 0 12 12">
                                      <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                                    </svg>
                                  </span>
                                </span>
                              </Switch>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="inline-flex">
                        <button onClick={() => openSettings(pipeline)}>
                          <Cog6ToothIcon className="mx-2 h-4 w-4 text-gray-400" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this pipeline?")) {
                              deletePipelineAction(pipeline.id);
                            }
                          }}>
                          <TrashIcon className="mx-2 h-4 w-4 text-gray-400" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <EmptyPageFiller
          alertText={`No active pipelines for '${form.label}'`}
          hintText="Add a pipeline to get started.">
          <div className="mx-10 mb-5 grid grid-cols-3 gap-3">
            {integrations.map((integration) => (
              <div className="col-span-1 my-1 flex" key={integration.id}>
                <div className="text-ui-gray-medium relative col-span-1 flex w-full">
                  <integration.icon className="text-ui-gray-medium h-6 w-6" />
                  <div className="inline-flex items-center truncate px-4 text-sm">
                    <p className="">{integration.name}</p>
                    {integration.comingSoon && (
                      <div className="ml-3 rounded-sm border border-teal-100 bg-teal-50 p-0.5 px-2">
                        <p className="text-xs text-teal-600">coming soon</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <hr />
          <ShareIcon className="stroke-thin mx-auto h-20 w-20 pt-6 text-slate-300" />
        </EmptyPageFiller>
      )}
      <AddPipelineModal open={openAddModal} setOpen={setOpenAddModal} />
      {openUpdateModal && (
        <UpdatePipelineModal
          open={openUpdateModal}
          setOpen={setOpenUpdateModal}
          pipelineId={updatePipelineId}
        />
      )}
    </div>
  );
}
