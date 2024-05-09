"use client";

import { BrushIcon, KeyIcon, LanguagesIcon, ListChecksIcon, TagIcon, UsersIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { SecondaryNavigation } from "@formbricks/ui/SecondaryNavigation";

interface ProductConfigNavigationProps {
  environmentId: string;
  activeId: string;
  isMultiLanguageAllowed: boolean;
}

export const ProductConfigNavigation = ({
  environmentId,
  activeId,
  isMultiLanguageAllowed,
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
      id: "setup",
      label: "Setup Guide",
      icon: <ListChecksIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/setup`,
      current: pathname?.includes("/setup"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
