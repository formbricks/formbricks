"use client";

import { BrushIcon, KeyIcon, LanguagesIcon, ListChecksIcon, TagIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";

interface ProductConfigNavigationProps {
  activeId: string;
  environmentId?: string;
  isMultiLanguageAllowed?: boolean;
  loading?: boolean;
}

export const ProductConfigNavigation = ({
  activeId,
  environmentId,
  isMultiLanguageAllowed,
  loading,
}: ProductConfigNavigationProps) => {
  const t = useTranslations();
  const pathname = usePathname();
  let navigation = [
    {
      id: "general",
      label: t("common.general"),
      icon: <UsersIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/general`,
      current: pathname?.includes("/general"),
    },
    {
      id: "look",
      label: t("common.look_and_feel"),
      icon: <BrushIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/look`,
      current: pathname?.includes("/look"),
    },
    {
      id: "languages",
      label: t("common.survey_languages"),
      icon: <LanguagesIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/languages`,
      hidden: !isMultiLanguageAllowed,
      current: pathname?.includes("/languages"),
    },
    {
      id: "tags",
      label: t("common.tags"),
      icon: <TagIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/tags`,
      current: pathname?.includes("/tags"),
    },
    {
      id: "api-keys",
      label: t("common.api_keys"),
      icon: <KeyIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/api-keys`,
      current: pathname?.includes("/api-keys"),
    },
    {
      id: "app-connection",
      label: t("common.website_and_app_connection"),
      icon: <ListChecksIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/app-connection`,
      current: pathname?.includes("/app-connection"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
