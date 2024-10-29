import { PersonSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonSecondaryNavigation";
import { CircleHelpIcon } from "lucide-react";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { Button } from "@formbricks/ui/components/Button";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { AttributeClassesTable } from "./components/AttributeClassesTable";

export const metadata: Metadata = {
  title: "Attributes",
};

const Page = async ({ params }) => {
  let attributeClasses = await getAttributeClasses(params.environmentId);
  const t = await getTranslations();
  const product = await getProductByEnvironmentId(params.environmentId);
  const locale = await findMatchingLocale();
  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  const HowToAddAttributesButton = (
    <Button
      size="sm"
      href="https://formbricks.com/docs/app-surveys/user-identification#setting-custom-user-attributes"
      variant="secondary"
      target="_blank"
      EndIcon={CircleHelpIcon}>
      {t("environments.attributes.how_to_add_attributes")}
    </Button>
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.people")} cta={HowToAddAttributesButton}>
        <PersonSecondaryNavigation activeId="attributes" environmentId={params.environmentId} />
      </PageHeader>
      <AttributeClassesTable attributeClasses={attributeClasses} locale={locale} />
    </PageContentWrapper>
  );
};

export default Page;
