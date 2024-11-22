import { LandingSidebar } from "@/app/(app)/(onboarding)/organizations/[organizationId]/landing/components/landing-sidebar";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/utils";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getOrganization, getOrganizationsByUserId } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { Header } from "@formbricks/ui/components/Header";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const user = await getUser(session.user.id);
  if (!user) return notFound();

  const organization = await getOrganization(params.organizationId);
  if (!organization) return notFound();

  const organizations = await getOrganizationsByUserId(session.user.id);

  const { features } = await getEnterpriseLicense();

  const isMultiOrgEnabled = features?.isMultiOrgEnabled ?? false;

  return (
    <div className="flex min-h-full min-w-full flex-row">
      <LandingSidebar
        user={user}
        organization={organization}
        isMultiOrgEnabled={isMultiOrgEnabled}
        organizations={organizations}
      />
      <div className="flex-1">
        <div className="flex h-full flex-col items-center justify-center space-y-12">
          <Header
            title={t("organizations.landing.no_projects_warning_title")}
            subtitle={t("organizations.landing.no_projects_warning_subtitle")}
          />
        </div>
      </div>
    </div>
  );
};

export default Page;
