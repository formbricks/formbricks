import { ArrowDownUpIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { BackIcon } from "@formbricks/ui/components/icons";

const Loading = () => {
  const t = useTranslations();
  return (
    <div>
      <main className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pointer-events-none animate-pulse cursor-not-allowed select-none">
          <button className="inline-flex pt-5 text-sm text-slate-500">
            <BackIcon className="mr-2 h-5 w-5" />
            Back
          </button>
        </div>
        <div className="flex items-baseline justify-between border-b border-slate-200 pb-6 pt-4">
          <h1 className="ph-no-capture text-4xl font-bold tracking-tight text-slate-900">
            <span className="animate-pulse rounded-full">{t("environments.people.fetching_user")}</span>
          </h1>
          <div className="flex items-center space-x-3">
            <button className="pointer-events-none animate-pulse cursor-not-allowed select-none">
              <TrashIcon className="h-5 w-5 text-slate-500 hover:text-red-700" />
            </button>
          </div>
        </div>
        <section className="pb-24 pt-6">
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-4">
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-700">{t("common.attributes")}</h2>
              <div>
                <dt className="text-sm font-medium text-slate-500">{t("common.email")}</dt>
                <dd className="ph-no-capture mt-1 text-sm text-slate-900">
                  <span className="animate-pulse text-slate-300">{t("common.loading")}</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">{t("common.user_id")}</dt>
                <dd className="ph-no-capture mt-1 text-sm text-slate-900">
                  <span className="animate-pulse text-slate-300">{t("common.loading")}</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">
                  {t("environments.people.formbricks_id")}
                </dt>
                <dd className="mt-1 animate-pulse text-sm text-slate-300">{t("common.loading")}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-slate-500">{t("environments.people.sessions")}</dt>
                <dd className="mt-1 animate-pulse text-sm text-slate-300">{t("common.loading")}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">{t("common.responses")}</dt>
                <dd className="mt-1 animate-pulse text-sm text-slate-300">{t("common.loading")}</dd>
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="flex items-center justify-between pb-6">
                <h2 className="text-lg font-bold text-slate-700">{t("common.responses")}</h2>
                <div className="text-right">
                  <button className="hover:text-brand-dark pointer-events-none flex animate-pulse cursor-not-allowed select-none items-center px-1 text-slate-800">
                    <ArrowDownUpIcon className="inline h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="group space-y-4 rounded-lg bg-white p-6">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 flex-shrink-0 rounded-full bg-slate-100"></div>
                  <div className="h-6 w-full rounded-full bg-slate-100"></div>
                </div>
                <div className="space-y-4">
                  <div className="h-12 w-full rounded-full bg-slate-100"></div>
                  <div className="flex h-12 w-full items-center justify-center rounded-full bg-slate-50 text-sm text-slate-500 hover:bg-slate-100">
                    <span className="animate-pulse text-center">
                      {t("environments.people.loading_user_responses")}
                    </span>
                  </div>
                  <div className="h-12 w-full rounded-full bg-slate-50/50"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Loading;
