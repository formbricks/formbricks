"use client";

import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { useTranslate } from "@tolgee/react";
import { BrushIcon, KeyIcon, LanguagesIcon, ListChecksIcon, TagIcon, UsersIcon } from "lucide-react";
import { usePathname } from "next/navigation";

interface ProjectConfigNavigationProps {
  activeId: string;
  environmentId?: string;
  isMultiLanguageAllowed?: boolean;
  loading?: boolean;
  canDoRoleManagement?: boolean;
}

export const ProjectConfigNavigation = ({
  activeId,
  environmentId,
  isMultiLanguageAllowed,
  loading,
  canDoRoleManagement,
}: ProjectConfigNavigationProps) => {
  const { t } = useTranslate();
  const pathname = usePathname();

  let navigation = [
    {
      id: "general",
      label: t("common.general"),
      icon: <UsersIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/project/general`,
      current: pathname?.includes("/general"),
    },
    {
      id: "look",
      label: t("common.look_and_feel"),
      icon: <BrushIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/project/look`,
      current: pathname?.includes("/look"),
    },
    {
      id: "languages",
      label: t("common.survey_languages"),
      icon: <LanguagesIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/project/languages`,
      hidden: !isMultiLanguageAllowed,
      current: pathname?.includes("/languages"),
    },
    {
      id: "tags",
      label: t("common.tags"),
      icon: <TagIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/project/tags`,
      current: pathname?.includes("/tags"),
    },
    {
      id: "api-keys",
      label: t("common.api_keys"),
      icon: <KeyIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/project/api-keys`,
      current: pathname?.includes("/api-keys"),
    },
    {
      id: "app-connection",
      label: t("common.website_and_app_connection"),
      icon: <ListChecksIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/project/app-connection`,
      current: pathname?.includes("/app-connection"),
    },
    {
      id: "teams",
      label: t("common.team_access"),
      href: `/environments/${environmentId}/project/teams`,
      hidden: !canDoRoleManagement,
      current: pathname?.includes("/teams"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
