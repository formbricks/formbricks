import { Switch } from "@headlessui/react";
import { BoltIcon, Cog6ToothIcon, TrashIcon } from "@heroicons/react/20/solid";
import { CodeBracketSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Pipeline } from "@prisma/client";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import {
  SiAirtable,
  SiGoogle,
  SiNotion,
  SiSlack,
  SiZapier,
} from "react-icons/si";
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
import {
  deletePipeline,
  persistPipeline,
  usePipelines,
} from "../../../lib/pipelines";
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
    id: "airtable",
    name: "Airtable",
    comingSoon: false,
    href: "#",
    bgColor: "bg-ui-gray-light",
    icon: SiAirtable,
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
  const {
    pipelines,
    isLoadingPipelines,
    isErrorPipelines,
    mutatePipelines,
  } = usePipelines(formId);
  const formMenuSteps = useFormMenuSteps(formId);
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openUpdateModal, setOpenUpdateModal] = useState(false);
  const [updatePipelineId, setUpdatePipelineId] = useState(null);

  const toggleEnabled = async (pipeline: Pipeline) => {
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

  const migrateAction = async () => {
    const submissionSessionRes = await fetch(
      `/api/forms/${formId}/submissionSessions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    const submissionSession = await submissionSessionRes.json();

    await fetch(`/api/forms/${formId}/eventmigration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            type: "pageSubmission",
            data: {
              pageName: "pageId",
              submissionSessionId: submissionSession.id,
              startDate: new Date(),
            },
          },
        ],
      }),
    }).catch((err) => {
      console.log({ err });
    });
  };

  const secondNavigation = useMemo(
    () => [
      {
        id: "add",
        onClick: () => setOpenAddModal(true),
        Icon: PlusIcon,
        label: "Ajouter un Pipeline ",
      },
    ],
    []
  );

  if (isLoadingForm || isLoadingPipelines) {
    return <Loading />;
  }

  if (isErrorForm || isErrorPipelines) {
    return (
      <MessagePage text="Unable to load this page. Maybe you don't have enough rights." />
    );
  }

  return (
    <BaseLayoutManagement
      title={`${form.name} - KDA Sourcing`}
      breadcrumbs={[{ name: form.name, href: "#", current: true }]}
      steps={formMenuSteps}
      currentStep="pipelines"
    >
      <SecondNavBar navItems={secondNavigation} currentItemId="formId" />
      <LimitedWidth>
        <header>
          <div className="mx-auto mt-8 max-w-7xl max-sm:pl-8 max-md:pl-8 max-md:pr-8">
            <h1 className="text-3xl font-bold leading-tight text-ui-gray-dark">
              Pipelines
            </h1>
          </div>
        </header>
        <div className="my-4 max-sm:pl-8 max-sm:pr-8 max-md:pl-8 max-md:pr-8">
          <p className="text-ui-gray-dark">
            Conduisez vos données exactement là où vous en avez besoin. Ajoutez
            des conditions pour l&lsquo;acheminement de données variables.
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
                        <div className="flex items-center flex-1 min-w-0">
                          <div className="flex-1 min-w-0 px-4 md:grid md:grid-cols-2 md:gap-4">
                            <div>
                              <p className="text-sm font-medium truncate text-ui-gray-dark">
                                {pipeline.name}
                              </p>
                              <p className="flex items-center mt-2 text-sm text-gray-500">
                                <BoltIcon
                                  className="mr-1.5 h-5 w-5 flex-shrink-0 text-gray-400"
                                  aria-hidden="true"
                                />
                                <span className="truncate">
                                  {pipeline.type}
                                </span>
                              </p>
                            </div>
                            <div className="hidden md:block">
                              <div>
                                {
                                  <p className="mb-1 text-xs text-ui-gray-dark">
                                    Active
                                  </p>
                                }
                                <Switch
                                  checked={pipeline.enabled}
                                  onChange={() => toggleEnabled(pipeline)}
                                  className={classNames(
                                    pipeline.enabled
                                      ? "bg-green-600"
                                      : "bg-gray-200",
                                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                                  )}
                                >
                                  <span className="sr-only">Use setting</span>
                                  <span
                                    className={classNames(
                                      pipeline.enabled
                                        ? "translate-x-5"
                                        : "translate-x-0",
                                      "pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                                    )}
                                  >
                                    <span
                                      className={classNames(
                                        pipeline.enabled
                                          ? "opacity-0 ease-out duration-100"
                                          : "opacity-100 ease-in duration-200",
                                        "absolute inset-0 flex h-full w-full items-center justify-center transition-opacity"
                                      )}
                                      aria-hidden="true"
                                    >
                                      <svg
                                        className="w-3 h-3 text-gray-400"
                                        fill="none"
                                        viewBox="0 0 12 12"
                                      >
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
                                          ? "opacity-100 ease-in duration-200"
                                          : "opacity-0 ease-out duration-100",
                                        "absolute inset-0 flex h-full w-full items-center justify-center transition-opacity"
                                      )}
                                      aria-hidden="true"
                                    >
                                      <svg
                                        className="w-3 h-3 text-green-600"
                                        fill="currentColor"
                                        viewBox="0 0 12 12"
                                      >
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
                            <Cog6ToothIcon
                              className="w-4 h-4 mx-2 text-gray-400"
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  "Are you sure you want to delete this pipeline?"
                                )
                              ) {
                                deletePipelineAction(pipeline.id);
                              }
                            }}
                          >
                            <TrashIcon
                              className="w-4 h-4 mx-2 text-gray-400"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </div>
                      {pipeline.type === "AIRTABLE" && (
                        <div>
                          <button
                            type="submit"
                            className="inline-flex my-2 justify-center px-4 py-2 ml-9  text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            onClick={() => {
                              if (
                                confirm(
                                  "Vous êtes sur le point d'envoyer les soumissions de tous les candidats du formulaire vers Airtable, Etes-vous sûr ?"
                                )
                              ) {
                                migrateAction();
                              }
                            }}
                          >
                            <p>Migrer vers Airtable</p>
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <EmptyPageFiller
            alertText={`Aucun pipeline actif pour '${form.name}'`}
            hintText="Ajoutez un pipeline pour commencer."
          >
            <div className="grid grid-cols-3 gap-3 mx-10 mb-5">
              {libs.map((lib) => (
                <div className="flex col-span-1 my-1" key={lib.id}>
                  <div className="relative flex w-full col-span-1 text-ui-gray-medium">
                    <lib.icon className="w-6 h-6 text-ui-gray-medium" />
                    <div className="inline-flex items-center px-4 text-sm truncate">
                      <p className="">{lib.name}</p>
                      {lib.comingSoon && (
                        <div className="p-0.5 px-2 ml-3 bg-green-50 rounded-sm border border-green-100">
                          <p className="text-xs text-green-600">
                            Bientôt disponible
                          </p>
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
