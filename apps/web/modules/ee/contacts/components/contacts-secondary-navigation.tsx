import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { TProduct } from "@formbricks/types/product";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";

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

  if (!loading && environmentId) {
    product = await getProductByEnvironmentId(environmentId);

    if (!product) {
      throw new Error("Product not found");
    }
  }

  const navigation = [
    {
      id: "contacts",
      label: "Contacts",
      href: `/environments/${environmentId}/contacts`,
    },
    {
      id: "segments",
      label: "Segments",
      href: `/environments/${environmentId}/segments`,
    },
    // {
    //   id: "attributes",
    //   label: "Attributes",
    //   href: `/environments/${environmentId}/attributes`,
    // },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
