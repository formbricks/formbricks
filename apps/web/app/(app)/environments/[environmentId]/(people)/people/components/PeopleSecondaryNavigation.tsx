import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { TProductConfigChannel } from "@formbricks/types/product";
import { SecondaryNavigation } from "@formbricks/ui/SecondaryNavigation";

interface PeopleSegmentsTabsProps {
  activeId: string;
  environmentId?: string;
  loading?: boolean;
}

export const PeopleSecondaryNavigation = async ({
  activeId,
  environmentId,
  loading,
}: PeopleSegmentsTabsProps) => {
  let currentProductChannel: TProductConfigChannel = null;

  if (!loading && environmentId) {
    const product = await getProductByEnvironmentId(environmentId);

    if (!product) {
      throw new Error("Product not found");
    }

    currentProductChannel = product.config.channel ?? null;
  }

  const navigation = [
    {
      id: "people",
      label: "People",
      href: `/environments/${environmentId}/people`,
    },
    {
      id: "segments",
      label: "Segments",
      href: `/environments/${environmentId}/segments`,
    },
    {
      id: "attributes",
      label: "Attributes",
      href: `/environments/${environmentId}/attributes`,
      // hide attributes tab if it's being used in the loading state or if the product's channel is website or link
      hidden: loading || !!(currentProductChannel && currentProductChannel !== "app"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
