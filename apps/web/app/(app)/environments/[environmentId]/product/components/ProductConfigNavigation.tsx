"use client";

import { usePathname } from "next/navigation";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";

interface ProductConfigNavigationProps {
  activeId: string;
  environmentId?: string;
  isMultiLanguageAllowed?: boolean;
  loading?: boolean;
  canDoRoleManagement?: boolean;
}

export const ProductConfigNavigation = ({
  activeId,
  environmentId,
  isMultiLanguageAllowed,
  loading,
  canDoRoleManagement,
}: ProductConfigNavigationProps) => {
  const pathname = usePathname();
  let navigation = [
    {
      id: "general",
      label: "General",
      href: `/environments/${environmentId}/product/general`,
      current: pathname?.includes("/general"),
    },
    {
      id: "look",
      label: "Look & Feel",
      href: `/environments/${environmentId}/product/look`,
      current: pathname?.includes("/look"),
    },
    {
      id: "languages",
      label: "Survey Languages",
      href: `/environments/${environmentId}/product/languages`,
      hidden: !isMultiLanguageAllowed,
      current: pathname?.includes("/languages"),
    },
    {
      id: "tags",
      label: "Tags",
      href: `/environments/${environmentId}/product/tags`,
      current: pathname?.includes("/tags"),
    },
    {
      id: "api-keys",
      label: "API Keys",
      href: `/environments/${environmentId}/product/api-keys`,
      current: pathname?.includes("/api-keys"),
    },
    {
      id: "app-connection",
      label: "Website & App Connection",
      href: `/environments/${environmentId}/product/app-connection`,
      current: pathname?.includes("/app-connection"),
    },
    {
      id: "access",
      label: "Access",
      href: `/environments/${environmentId}/product/access`,
      hidden: !canDoRoleManagement,
      current: pathname?.includes("/access"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
