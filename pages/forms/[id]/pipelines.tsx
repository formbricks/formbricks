import { useMemo, useState } from "react";
import { CodeIcon, PlusIcon, PuzzleIcon } from "@heroicons/react/outline";
import { useRouter } from "next/router";
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
import { useForm } from "../../../lib/forms";
import { useFormMenuSteps } from "../../../lib/navigation/formMenuSteps";
import { classNames } from "../../../lib/utils";
import AddIntegrationModal from "../../../components/pipelines/AddPipelineModal";
import WebhookSettingsModal from "../../../components/pipelines/WebhookSettings";

const libs = [
  {
    id: "webhook",
    name: "Webhook",
    href: "#",
    comingSoon: false,
    bgColor: "bg-ui-gray-light",
    icon: CodeIcon,
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
  const { form, isLoadingForm, isErrorForm } = useForm(router.query.id);
  const formMenuSteps = useFormMenuSteps(formId);
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openSettings, setOpenSettings] = useState(true);

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

  if (isLoadingForm) {
    return <Loading />;
  }

  if (isErrorForm) {
    return (
      <MessagePage text="Unable to load this page. Maybe you don't have enough rights." />
    );
  }

  return (
    <BaseLayoutManagement
      title={`${form.name} - snoopForms`}
      breadcrumbs={[{ name: form.name, href: "#", current: true }]}
      steps={formMenuSteps}
      currentStep="pipelines"
    >
      <SecondNavBar navItems={secondNavigation} currentItemId="formId" />
      <LimitedWidth>
        <header>
          <div className="mx-auto mt-8 max-w-7xl">
            <h1 className="text-3xl font-bold leading-tight text-ui-gray-dark">
              Data Pipelines
            </h1>
          </div>
        </header>
        <div className="my-4">
          <p className="text-ui-gray-dark">
            Pipe your data exactly where you need it. Add conditions for
            variable data piping.
          </p>
        </div>
        <EmptyPageFiller
          alertText={`No active pipelines for '${form.name}'`}
          hintText="Setup a data pipeline below."
        >
          <PuzzleIcon className="w-24 h-24 mx-auto text-ui-gray-medium stroke-thin" />
        </EmptyPageFiller>
        <div>
          <div className="my-16">
            <div>
              <h2 className="text-xl font-bold text-ui-gray-dark">
                Available Integrations
              </h2>

              <ul
                role="list"
                className="grid grid-cols-1 gap-5 mt-3 sm:gap-6 sm:grid-cols-3 lg:grid-cols-3"
              >
                {libs.map((lib) => (
                  <a
                    className="flex col-span-1 rounded-md shadow-sm"
                    key={lib.id}
                    onClick={lib.action}
                  >
                    <li
                      className={classNames(
                        lib.comingSoon
                          ? "text-ui-gray-medium"
                          : "shadow-sm text-ui-gray-dark hover:text-black",
                        "relative flex col-span-1 rounded-md w-full h-20"
                      )}
                    >
                      <div
                        className={classNames(
                          lib.bgColor,
                          "absolute h-20 flex-shrink-0 flex items-center justify-center w-20 z-10 text-white text-sm font-medium rounded-md"
                        )}
                      >
                        <lib.icon
                          className={classNames(
                            lib.comingSoon
                              ? "text-ui-gray-medium w-8 h-8"
                              : "text-white stroke-1 w-10 h-10",
                            ""
                          )}
                        />
                      </div>
                      <div
                        className={classNames(
                          lib.comingSoon ? "border-dashed" : "",
                          "ml-16 pl-3 flex items-center justify-between flex-1 truncate bg-white rounded-r-md"
                        )}
                      >
                        <div className="inline-flex px-4 py-8 text-sm truncate">
                          <p className="">{lib.name}</p>
                          {lib.comingSoon && (
                            <div className="p-1 px-3 ml-3 bg-green-100 rounded-sm">
                              <p className="text-xs text-black">coming soon</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  </a>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <AddIntegrationModal open={openAddModal} setOpen={setOpenAddModal} />
        <WebhookSettingsModal open={openSettings} setOpen={setOpenSettings} />
      </LimitedWidth>
    </BaseLayoutManagement>
  );
}

export default withAuthentication(PipelinesPage);
