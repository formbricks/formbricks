import { CodeIcon, PuzzleIcon } from "@heroicons/react/outline";
import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import {
  SiAirtable,
  SiGoogle,
  SiNotion,
  SiSlack,
  SiZapier,
} from "react-icons/si";
import BaseLayoutAuthorized from "../../../components/layout/BaseLayoutAuthorized";
import EmptyPageFiller from "../../../components/layout/EmptyPageFiller";
import LimitedWidth from "../../../components/layout/LimitedWidth";
import Loading from "../../../components/Loading";
import { useForm } from "../../../lib/forms";
import { useFormMenuSteps } from "../../../lib/navigation/formMenuSteps";
import { classNames } from "../../../lib/utils";

const libs = [
  {
    id: "webhook",
    name: "Webhook",
    href: "#",
    comingSoon: true,
    bgColor: "bg-ui-gray-light",
    icon: CodeIcon,
  },
  {
    id: "Notion",
    name: "Notion",
    comingSoon: true,
    href: "#",
    bgColor: "bg-ui-gray-light",
    icon: SiNotion,
  },
  {
    id: "googleSheets",
    name: "Google Sheets",
    comingSoon: true,
    href: "#",
    bgColor: "bg-ui-gray-light",
    icon: SiGoogle,
  },
  {
    id: "zapier",
    name: "Zapier",
    comingSoon: true,
    href: "#",
    bgColor: "bg-ui-gray-light",
    icon: SiZapier,
  },
  {
    id: "airtable",
    name: "Airtable",
    comingSoon: true,
    href: "#",
    bgColor: "bg-ui-gray-light",
    icon: SiAirtable,
  },
  {
    id: "slack",
    name: "Slack",
    comingSoon: true,
    href: "#",
    bgColor: "bg-ui-gray-light",
    icon: SiSlack,
  },
];

export default function PipelinesPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(router.query.id);
  const formMenuSteps = useFormMenuSteps(formId);

  if (isLoadingForm) {
    return <Loading />;
  }

  return (
    <>
      <BaseLayoutAuthorized
        title={`${form.name} - snoopForms`}
        breadcrumbs={[{ name: form.name, href: "#", current: true }]}
        steps={formMenuSteps}
        currentStep="pipelines"
      >
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
            <div className="mt-16">
              <div>
                <h2 className="text-xl font-bold text-ui-gray-dark">
                  Integrations
                </h2>

                <ul
                  role="list"
                  className="grid grid-cols-1 gap-5 mt-3 sm:gap-6 sm:grid-cols-3 lg:grid-cols-3"
                >
                  {libs.map((lib) => (
                    <a
                      className="flex col-span-1 rounded-md shadow-sm"
                      key={lib.id}
                    >
                      <li
                        className={classNames(
                          lib.comingSoon
                            ? "text-ui-gray-medium"
                            : "shadow-sm text-ui-gray-dark hover:text-black",
                          "flex col-span-1 rounded-md w-full"
                        )}
                      >
                        <div
                          className={classNames(
                            lib.bgColor,
                            "flex-shrink-0 flex items-center justify-center w-20 text-white text-sm font-medium rounded-md"
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
                            "flex items-center justify-between flex-1 truncate bg-white rounded-r-md"
                          )}
                        >
                          <div className="inline-flex px-4 py-8 text-sm truncate">
                            <p className="">{lib.name}</p>
                            {lib.comingSoon && (
                              <div className="p-1 px-3 ml-3 bg-green-100 rounded-sm">
                                <p className="text-xs text-black">
                                  coming soon
                                </p>
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
        </LimitedWidth>
      </BaseLayoutAuthorized>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession({ req });
  if (!session) {
    res.statusCode = 403;
  }
  return { props: {} };
};
