import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { CheckIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { getEnterpriseLicense } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { Button } from "@formbricks/ui/Button";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

const Page = async ({ params }) => {
  if (IS_FORMBRICKS_CLOUD) {
    notFound();
  }

  const session = await getServerSession(authOptions);

  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!session) {
    throw new Error("Unauthorized");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isAdmin, isOwner } = getAccessFlags(currentUserMembership?.role);
  const isPricingDisabled = !isOwner && !isAdmin;

  if (isPricingDisabled) {
    notFound();
  }

  const { active: isEnterpriseEdition } = await getEnterpriseLicense();

  const paidFeatures = [
    {
      title: "Multi-Language Surveys",
      comingSoon: false,
      onRequest: false,
    },
    {
      title: "Organization Roles (Admin, Editor, Developer, etc.)",
      comingSoon: false,
      onRequest: false,
    },
    {
      title: "Advanced Targeting and Segmentation (In-app Surveys)",
      comingSoon: false,
      onRequest: false,
    },
    {
      title: "Audit Logs",
      comingSoon: false,
      onRequest: true,
    },
    {
      title: "SAML SSO",
      comingSoon: false,
      onRequest: true,
    },
    {
      title: "Service Level Agreement",
      comingSoon: false,
      onRequest: true,
    },
    {
      title: "SOC2, HIPAA, ISO 27001 Compliance check",
      comingSoon: false,
      onRequest: true,
    },
    {
      title: "Custom Feature Development",
      comingSoon: false,
      onRequest: true,
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Organization Settings">
        <OrganizationSettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="enterprise"
        />
      </PageHeader>
      {isEnterpriseEdition ? (
        <div>
          <div className="mt-8 max-w-4xl rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
            <div className="space-y-4 p-8">
              <div className="flex items-center gap-x-2">
                <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                  <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-400" />
                </div>
                <p className="text-slate-800">Your Enterprise License is active. All features unlocked 🚀</p>
              </div>
              <p className="text-sm text-slate-500">
                Questions? Please reach out to{" "}
                <a className="font-semibold underline" href="mailto:hola@formbricks.com">
                  hola@formbricks.com
                </a>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="relative isolate mt-8 overflow-hidden rounded-lg bg-slate-900 px-3 pt-8 shadow-2xl sm:px-8 md:pt-12 lg:flex lg:gap-x-10 lg:px-12 lg:pt-0">
            <svg
              viewBox="0 0 1024 1024"
              className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
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
                Unlock the full power of Formbricks. Free for 30 days.
              </h2>
              <p className="text-md mt-6 leading-8 text-slate-300">
                Keep full control over your data privacy and security.
                <br />
                Get an Enterprise license to get access to all features.
              </p>
            </div>
          </div>
          <div className="mt-8 rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
            <div className="p-8">
              <h2 className="mr-2 inline-flex text-2xl font-bold text-slate-700">Enterprise Features</h2>
              <ul className="my-4 space-y-4">
                {paidFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <div className="rounded-full border border-green-300 bg-green-100 p-0.5 dark:bg-green-800">
                      <CheckIcon className="h-5 w-5 p-0.5 text-green-500 dark:text-green-400" />
                    </div>
                    <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{feature.title}</span>
                    {feature.comingSoon && (
                      <span className="mx-2 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700 dark:bg-slate-700 dark:text-teal-500">
                        coming soon
                      </span>
                    )}
                    {feature.onRequest && (
                      <span className="mx-2 rounded-full bg-violet-100 px-3 py-1 text-xs text-violet-700 dark:bg-slate-700 dark:text-teal-500">
                        on request
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="my-6 text-sm text-slate-700">
                No call needed, no strings attached: Request a free 30-day trial license to test all features
                by filling out this form:
              </p>
              <Button href="https://app.formbricks.com/s/clvupq3y205i5yrm3sm9v1xt5" target="_blank">
                Request 30-day Trial License
              </Button>
              <p className="mt-2 text-xs text-slate-500">No credit card. No sales call. Just test it :)</p>
            </div>
          </div>
        </div>
      )}
    </PageContentWrapper>
  );
};

export default Page;
