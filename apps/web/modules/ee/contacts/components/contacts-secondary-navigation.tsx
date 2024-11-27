import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { getTranslations } from "next-intl/server";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { TProduct } from "@formbricks/types/product";

interface PersonSecondaryNavigationProps {
  activeId: string;
  environmentId?: string;
  loading?: boolean;
}

export const ContactsSecondaryNavigation = async ({
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
      id: "contacts",
      label: t("common.contacts"),
      href: `/environments/${environmentId}/contacts`,
    },
    {
      id: "segments",
      label: t("common.segments"),
      href: `/environments/${environmentId}/segments`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
