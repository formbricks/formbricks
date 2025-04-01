import { LandingSidebar } from "@/app/(app)/(onboarding)/organizations/[organizationId]/landing/components/landing-sidebar";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { Header } from "@/modules/ui/components/header";
import { getTranslate } from "@/tolgee/server";
import { notFound, redirect } from "next/navigation";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, organization } = await getOrganizationAuth(params.organizationId);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const user = await getUser(session.user.id);
  if (!user) return notFound();

  const organizations = await getOrganizationsByUserId(session.user.id);

  const isMultiOrgEnabled = false;

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
