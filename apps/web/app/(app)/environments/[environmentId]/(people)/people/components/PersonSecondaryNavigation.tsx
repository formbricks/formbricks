import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { getTranslations } from "next-intl/server";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { TProduct } from "@formbricks/types/product";

interface PersonSecondaryNavigationProps {
  activeId: string;
  environmentId?: string;
  loading?: boolean;
}

export const PersonSecondaryNavigation = async ({
  activeId,
  environmentId,
  loading,
}: PersonSecondaryNavigationProps) => {
  let product: TProduct | null = null;
  const t = await getTranslations();
  if (!loading && environmentId) {
    product = await getProductByEnvironmentId(environmentId);

    if (!product) {
      throw new Error("Product not found");
    }
  }

  const navigation = [
    {
      id: "people",
      label: t("common.people"),
      href: `/environments/${environmentId}/people`,
    },
    {
      id: "segments",
      label: t("common.segments"),
      href: `/environments/${environmentId}/segments`,
    },
    {
      id: "attributes",
      label: t("common.attributes"),
      href: `/environments/${environmentId}/attributes`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
