import { Switch } from "@headlessui/react";
import { BoltIcon, Cog6ToothIcon, TrashIcon } from "@heroicons/react/20/solid";
import { CodeBracketSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { SiAirtable, SiGoogle, SiNotion, SiSlack, SiZapier } from "react-icons/si";
import { AiOutlineMail } from "react-icons/ai";

import BaseLayoutManagement from "../../../components/layout/BaseLayoutManagement";
import EmptyPageFiller from "../../../components/layout/EmptyPageFiller";
import LimitedWidth from "../../../components/layout/LimitedWidth";
import SecondNavBar from "../../../components/layout/SecondNavBar";
import withAuthentication from "../../../components/layout/WithAuthentication";
import Loading from "../../../components/Loading";
import MessagePage from "../../../components/MessagePage";
import AddPipelineModal from "../../../components/pipelines/AddPipelineModal";
import UpdatePipelineModal from "../../../components/pipelines/UpdatePipelineModal";
import { useForm } from "../../../lib/forms";
import { useFormMenuSteps } from "../../../lib/navigation/formMenuSteps";
import { deletePipeline, persistPipeline, usePipelines } from "../../../lib/pipelines";
import { classNames } from "../../../lib/utils";

const libs = [
  {
    id: "webhook",
    name: "Webhook",
    href: "#",
    comingSoon: false,
    bgColor: "bg-ui-gray-light",
    icon: CodeBracketSquareIcon,
    action: () => {},
  },
  {
    id: "email notification",
    name: "Email Notification",
    href: "#",
    comingSoon: false,
    bgColor: "bg-ui-gray-light",
    icon: AiOutlineMail,
    action: () => {},
  },
  {
    id: "Notion",
    name: "Notion",
    comingSoon: true,
    href: "#",
    bgColor: "bg-ui-gray-light",
    icon: SiNotion,
    action: () => {},
  },
  {
    id: "googleSheets",
    name: "Google Sheets",
    comingSoon: true,
    href: "#",
    bgColor: "bg-ui-gray-light",
    icon: SiGoogle,
    action: () => {},
  },
  {
    id: "zapier",
    name: "Zapier",
    comingSoon: true,
    href: "#",
    bgColor: "bg-ui-gray-light",
    icon: SiZapier,
    action: () => {},
  },
  {
    id: "airtable",
    name: "Airtable",
    comingSoon: true,
    href: "#",
    bgColor: "bg-ui-gray-light",
    icon: SiAirtable,
    action: () => {},
  },
  {
    id: "slack",
    name: "Slack",
    comingSoon: true,
    href: "#",
    bgColor: "bg-ui-gray-light",
    icon: SiSlack,
    action: () => {},
  },
];

function PipelinesPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm, isErrorForm } = useForm(formId);
  const { pipelines, isLoadingPipelines, isErrorPipelines, mutatePipelines } = usePipelines(formId);
  const formMenuSteps = useFormMenuSteps(formId);
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openUpdateModal, setOpenUpdateModal] = useState(false);
  const [updatePipelineId, setUpdatePipelineId] = useState(null);

  const toggleEnabled = async (pipeline) => {
    const newPipeline = JSON.parse(JSON.stringify(pipeline));
    newPipeline.enabled = !newPipeline.enabled;
    await persistPipeline(newPipeline);
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
    await deletePipeline(formId, pipelineId);
    const newPipelines = JSON.parse(JSON.stringify(pipelines));
    const pipelineIdx = newPipelines.findIndex((p) => p.id === pipelineId);
    if (pipelineIdx > -1) {
      newPipelines.splice(pipelineIdx, 1);
      mutatePipelines(newPipelines);
    }
  };

  const secondNavigation = useMemo(
    () => [
      {
        id: "add",
        onClick: () => setOpenAddModal(true),
        Icon: PlusIcon,
        label: "Add Pipeline",
      },
    ],
    []
  );

  if (isLoadingForm || isLoadingPipelines) {
    return <Loading />;
  }

  if (isErrorForm || isErrorPipelines) {
    return <MessagePage text="Unable to load this page. Maybe you don't have enough rights." />;
  }

  return (
    <BaseLayoutManagement
      title={`${form.name} - snoopForms`}
      breadcrumbs={[{ name: form.name, href: "#", current: true }]}
      steps={formMenuSteps}
      currentStep="pipelines">
      <SecondNavBar navItems={secondNavigation} currentItemId="formId" />
      <LimitedWidth>
        <header>
          <div className="mx-auto mt-8 max-w-7xl">
            <h1 className="text-ui-gray-dark text-3xl font-bold leading-tight">Data Pipelines</h1>
          </div>
        </header>
        <div className="my-4">
          <p className="text-ui-gray-dark">
            Pipe your data exactly where you need it. Add conditions for variable data piping.
          </p>
        </div>
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
                              <p className="text-ui-gray-dark truncate text-sm font-medium">
                                {pipeline.name}
                              </p>
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
                                {<p className="text-ui-gray-dark mb-1 text-xs">Active</p>}
                                <Switch
                                  checked={pipeline.enabled}
                                  onChange={() => toggleEnabled(pipeline)}
                                  className={classNames(
                                    pipeline.enabled ? "bg-green-600" : "bg-gray-200",
                                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                                  )}>
                                  <span className="sr-only">Use setting</span>
                                  <span
                                    className={classNames(
                                      pipeline.enabled ? "translate-x-5" : "translate-x-0",
                                      "pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                                    )}>
                                    <span
                                      className={classNames(
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
                                      className={classNames(
                                        pipeline.enabled
                                          ? "opacity-100 duration-200 ease-in"
                                          : "opacity-0 duration-100 ease-out",
                                        "absolute inset-0 flex h-full w-full items-center justify-center transition-opacity"
                                      )}
                                      aria-hidden="true">
                                      <svg
                                        className="h-3 w-3 text-green-600"
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
            alertText={`No active pipelines for '${form.name}'`}
            hintText="Add a pipeline to get started.">
            <div className="mx-10 mb-5 grid grid-cols-3 gap-3">
              {libs.map((lib) => (
                <div className="col-span-1 my-1 flex" key={lib.id}>
                  <div className="text-ui-gray-medium relative col-span-1 flex w-full">
                    <lib.icon className="text-ui-gray-medium h-6 w-6" />
                    <div className="inline-flex items-center truncate px-4 text-sm">
                      <p className="">{lib.name}</p>
                      {lib.comingSoon && (
                        <div className="ml-3 rounded-sm border border-green-100 bg-green-50 p-0.5 px-2">
                          <p className="text-xs text-green-600">coming soon</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <hr />
          </EmptyPageFiller>
        )}
        <AddPipelineModal open={openAddModal} setOpen={setOpenAddModal} />
        <UpdatePipelineModal
          open={openUpdateModal}
          setOpen={setOpenUpdateModal}
          formId={formId}
          pipelineId={updatePipelineId}
        />
      </LimitedWidth>
    </BaseLayoutManagement>
  );
}

export default withAuthentication(PipelinesPage);
