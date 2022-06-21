import { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import LayoutFormBasics from "../../../components/layout/LayoutFormBasic";
import Loading from "../../../components/Loading";
import { useForm } from "../../../lib/forms";
import { BiPlug } from "react-icons/bi";
import { SiZapier, SiAirtable, SiSlack } from "react-icons/si";
import { FaCode, FaGoogle } from "react-icons/fa";
import { classNames } from "../../../lib/utils";

const libs = [
  {
    id: "webhook",
    name: "Webhook",
    href: "#",
    bgColor: "bg-red-500",
    icon: FaCode,
  },
  {
    id: "googleSheets",
    name: "Google Sheets",
    comingSoon: true,
    href: "#",
    bgColor: "bg-green-700",
    icon: FaGoogle,
  },
  {
    id: "zapier",
    name: "Zapier",
    comingSoon: true,
    href: "#",
    bgColor: "bg-orange-500",
    icon: SiZapier,
  },
  {
    id: "airtable",
    name: "Airtable",
    comingSoon: true,
    href: "#",
    bgColor: "bg-sky-400",
    icon: SiAirtable,
  },
  {
    id: "slack",
    name: "Slack",
    comingSoon: true,
    href: "#",
    bgColor: "bg-purple-800",
    icon: SiSlack,
  },
];

export default function PipelinesPage() {
  const router = useRouter();
  const formId = router.query.id.toString();
  const { form, isLoadingForm } = useForm(router.query.id);

  if (isLoadingForm) {
    return <Loading />;
  }

  return (
    <>
      <LayoutFormBasics
        title={form.title}
        formId={formId}
        currentStep="pipelines"
      >
        <header>
          <div className="mx-auto mt-8 max-w-7xl">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">
              Pipe your data
            </h1>
          </div>
        </header>
        <div className="my-4">
          <p className="text-gray-700">
            snoopHub automatically stores your data and gives you an overview of
            your submissions and form analytics. If you want to use your
            submissions or form events in other systems you can set up pipelines
            to let snoopHub sent the data to these applications as soon as it
            arrives and keep everything in sync.
          </p>
        </div>
        <div>
          <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Active integrations
          </div>
          <div className="p-3 my-5 text-center border rounded-lg shadow-inner sm:p-6">
            <BiPlug className="w-12 h-12 mx-auto text-gray-400" />

            <h3 className="mt-2 text-sm font-medium text-gray-900">
              You don&apos;t have any active pipelines
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Choose a method from the available integrations and set up your
              pipeline
            </p>
          </div>
        </div>
        <div>
          <div className="mt-8">
            <div>
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                Available integrations
              </p>

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
                        lib.comingSoon ? "opacity-50" : "",
                        "flex col-span-1 rounded-md shadow-sm w-full"
                      )}
                    >
                      <div
                        className={classNames(
                          lib.bgColor,
                          "flex-shrink-0 flex items-center justify-center w-16 text-white text-sm font-medium rounded-l-md"
                        )}
                      >
                        <lib.icon className="w-5 h-5" />
                      </div>
                      <div
                        className={classNames(
                          lib.comingSoon ? "border-dashed" : "",
                          "flex items-center justify-between flex-1 truncate bg-white border-t border-b border-r border-gray-200 rounded-r-md"
                        )}
                      >
                        <div className="inline-flex px-4 py-8 text-sm truncate">
                          <p className="font-medium text-gray-900 hover:text-gray-600">
                            {lib.name}
                          </p>
                          {lib.comingSoon && (
                            <p className="ml-1 text-gray-500">(coming soon)</p>
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
      </LayoutFormBasics>
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
