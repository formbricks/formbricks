import { CheckIcon, RocketIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EnterpriseLicenseFeaturesTable } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/enterprise/components/EnterpriseLicenseFeaturesTable";
import { EnterpriseLicenseStatus } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/enterprise/components/EnterpriseLicenseStatus";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { GRACE_PERIOD_MS, getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getSettingsLayoutData } from "@/modules/settings/lib/navigation-data";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Page = async (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const params = await props.params;
  const t = await getTranslate();
  const { session, isBilling, isMember } = await getOrganizationAuth(params.organizationId);

  if (isBilling && IS_FORMBRICKS_CLOUD) {
    redirect(getOrganizationBillingPath(params.organizationId, IS_FORMBRICKS_CLOUD));
  }

  if (IS_FORMBRICKS_CLOUD) {
    return notFound();
  }

  if (isMember) {
    return notFound();
  }

  const [licenseState, layoutData] = await Promise.all([
    getEnterpriseLicense(),
    getSettingsLayoutData(session.user.id, params.organizationId),
  ]);
  const hasLicense = licenseState.status !== "no-license";
  const workspaceId = layoutData?.currentWorkspace?.id ?? "";

  const paidFeatures = [
    t("workspace.settings.enterprise.hide_powered_by_formbricks"),
    t("workspace.settings.enterprise.whitelabel_email_follow_ups"),
    t("workspace.settings.enterprise.teams_and_access_roles"),
    t("workspace.settings.enterprise.contacts_and_segments"),
    t("workspace.settings.enterprise.quota_management"),
    t("workspace.settings.enterprise.unify_feedback_inbox"),
    t("workspace.settings.enterprise.feedback_directories"),
    t("workspace.settings.enterprise.insights_dashboards"),
    t("workspace.settings.enterprise.audit_logs"),
    t("workspace.settings.enterprise.oidc_sso"),
    t("workspace.settings.enterprise.saml_sso"),
    t("workspace.settings.enterprise.spam_protection_recaptcha"),
    t("workspace.settings.enterprise.two_factor_authentication"),
    t("workspace.settings.enterprise.custom_workspace_count"),
    t("workspace.settings.enterprise.white_glove_onboarding"),
    t("workspace.settings.enterprise.support_slas"),
  ];

  const liteLicenseUrl = new URL(ENTERPRISE_LICENSE_REQUEST_FORM_URL);
  liteLicenseUrl.searchParams.set("type", "lite");

  const trialLicenseUrl = new URL(ENTERPRISE_LICENSE_REQUEST_FORM_URL);
  trialLicenseUrl.searchParams.set("type", "trial");

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.enterprise_license")} />
      {hasLicense ? (
        <>
          <EnterpriseLicenseStatus
            status={licenseState.status}
            lastChecked={licenseState.lastChecked}
            gracePeriodEnd={
              licenseState.status === "unreachable"
                ? new Date(licenseState.lastChecked.getTime() + GRACE_PERIOD_MS)
                : undefined
            }
            workspaceId={workspaceId}
          />
          {licenseState.features && <EnterpriseLicenseFeaturesTable features={licenseState.features} />}
        </>
      ) : (
        <div>
          <div className="relative isolate mt-8 overflow-hidden rounded-lg bg-slate-900 px-3 pt-8 shadow-2xl sm:px-8 md:pt-12 lg:flex lg:gap-x-10 lg:px-12 lg:pt-0">
            <svg
              viewBox="0 0 1024 1024"
              className="absolute top-1/2 left-1/2 -z-10 size-256 -translate-y-1/2 mask-[radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
              aria-hidden="true">
              <circle
                cx={512}
                cy={512}
                r={512}
                fill="url(#759c1415-0410-454c-8f7c-9a820de03641)"
                fillOpacity="0.7"
              />
              <defs>
                <radialGradient id="759c1415-0410-454c-8f7c-9a820de03641">
                  <stop stopColor="#00E6CA" />
                  <stop offset={0} stopColor="#00C4B8" />
                </radialGradient>
              </defs>
            </svg>
            <div className="mx-auto text-center lg:mx-0 lg:flex-auto lg:py-16 lg:text-left">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                {t("workspace.settings.enterprise.unlock_the_full_power_of_formbricks_free_for_30_days")}
              </h2>
              <p className="text-md mt-6 leading-8 text-slate-300">
                {t("workspace.settings.enterprise.keep_full_control_over_your_data_privacy_and_security")}
                <br />
                {t("workspace.settings.enterprise.get_an_enterprise_license_to_get_access_to_all_features")}
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col rounded-lg border border-slate-300 bg-slate-100 p-8 shadow-xs">
              <div className="w-fit rounded-md border border-slate-200 bg-white p-3">
                <SparklesIcon className="size-6 text-teal-600" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-700">
                {t("workspace.settings.enterprise.lite_license_title")}
              </h3>
              <p className="mt-2 grow text-sm text-slate-500">
                {t("workspace.settings.enterprise.lite_license_description")}
              </p>
              <Button asChild className="mt-6 w-fit">
                <Link
                  href={liteLicenseUrl.toString()}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  referrerPolicy="no-referrer">
                  {t("workspace.settings.enterprise.request_lite_license")}
                </Link>
              </Button>
            </div>
            <div className="flex flex-col rounded-lg border border-slate-300 bg-slate-100 p-8 shadow-xs">
              <div className="w-fit rounded-md border border-slate-200 bg-white p-3">
                <RocketIcon className="size-6 text-teal-600" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-700">
                {t("workspace.settings.enterprise.full_feature_trial_title")}
              </h3>
              <p className="mt-2 grow text-sm text-slate-500">
                {t("workspace.settings.enterprise.full_feature_trial_description")}
              </p>
              <Button asChild className="mt-6 w-fit">
                <Link
                  href={trialLicenseUrl.toString()}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  referrerPolicy="no-referrer">
                  {t("workspace.settings.enterprise.request_trial_license")}
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-8 rounded-lg border border-slate-300 bg-slate-100 shadow-xs">
            <div className="p-8">
              <h2 className="mr-2 inline-flex text-2xl font-bold text-slate-700">
                {t("workspace.settings.enterprise.enterprise_features")}
              </h2>
              <ul className="my-4 space-y-4">
                {paidFeatures.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                      <CheckIcon className="size-5 p-0.5 text-green-500 dark:text-green-400" />
                    </div>
                    <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </PageContentWrapper>
  );
};

export default Page;
