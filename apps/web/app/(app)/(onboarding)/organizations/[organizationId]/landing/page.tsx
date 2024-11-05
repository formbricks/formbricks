import { CreateOrganization } from "@/app/(app)/(onboarding)/organizations/[organizationId]/landing/components/create-organization";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getEnterpriseLicense } from "@formbricks/ee/lib/service";
import { getOrganization } from "@formbricks/lib/organization/service";
import { Header } from "@formbricks/ui/components/Header";

interface OrganizationLandingProps {
  params: {
    organizationId: string;
  };
}

const Page = async ({ params }: OrganizationLandingProps) => {
  const organization = await getOrganization(params.organizationId);
  const t = await getTranslations();
  if (!organization) {
    return notFound();
  }

  const { features } = await getEnterpriseLicense();

  const isMultiOrgEnabled = features?.isMultiOrgEnabled ?? false;

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header
        title={t("organizations.landing.no_products_warning_title")}
        subtitle={t("organizations.landing.no_products_warning_subtitle")}
      />
      {isMultiOrgEnabled && <CreateOrganization />}
    </div>
  );
};

export default Page;
