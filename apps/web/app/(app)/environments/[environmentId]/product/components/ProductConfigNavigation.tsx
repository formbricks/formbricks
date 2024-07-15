"use client";

import { BrushIcon, KeyIcon, LanguagesIcon, ListChecksIcon, TagIcon, UsersIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { TProductConfigChannel } from "@formbricks/types/product";
import { SecondaryNavigation } from "@formbricks/ui/SecondaryNavigation";

interface ProductConfigNavigationProps {
  environmentId: string;
  activeId: string;
  isMultiLanguageAllowed: boolean;
  productChannel: TProductConfigChannel;
}

export const ProductConfigNavigation = ({
  environmentId,
  activeId,
  isMultiLanguageAllowed,
  productChannel,
}: ProductConfigNavigationProps) => {
  const pathname = usePathname();
  let navigation = [
    {
      id: "general",
      label: "General",
      icon: <UsersIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/general`,
      current: pathname?.includes("/general"),
    },
    {
      id: "look",
      label: "Look & Feel",
      icon: <BrushIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/look`,
      current: pathname?.includes("/look"),
    },
    {
      id: "languages",
      label: "Survey Languages",
      icon: <LanguagesIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/languages`,
      hidden: !isMultiLanguageAllowed,
      current: pathname?.includes("/languages"),
    },
    {
      id: "tags",
      label: "Tags",
      icon: <TagIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/tags`,
      current: pathname?.includes("/tags"),
    },
    {
      id: "api-keys",
      label: "API Keys",
      icon: <KeyIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/api-keys`,
      current: pathname?.includes("/api-keys"),
    },
    {
      id: "website-connection",
      label: "Website Connection",
      icon: <ListChecksIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/website-connection`,
      current: pathname?.includes("/website-connection"),
      hidden: !!(productChannel && productChannel !== "website"),
    },
    {
      id: "app-connection",
      label: "App Connection",
      icon: <ListChecksIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/app-connection`,
      current: pathname?.includes("/app-connection"),
      hidden: !!(productChannel && productChannel !== "app"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
