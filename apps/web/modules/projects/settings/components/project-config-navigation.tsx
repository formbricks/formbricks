"use client";

import {
  BlocksIcon,
  BrushIcon,
  Cable,
  LanguagesIcon,
  ListChecksIcon,
  TagIcon,
  UsersIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface ProjectConfigNavigationProps {
  activeId: string;
  environmentId?: string;
  loading?: boolean;
}

export const ProjectConfigNavigation = ({
  activeId,
  environmentId,
  loading,
}: ProjectConfigNavigationProps) => {
  const { t } = useTranslation();
  const pathname = usePathname();

  let navigation = [
    {
      id: "general",
      label: t("common.general"),
      icon: <UsersIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/workspace/general`,
      current: pathname?.includes("/general"),
    },
    {
      id: "look",
      label: t("common.look_and_feel"),
      icon: <BrushIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/workspace/look`,
      current: pathname?.includes("/look"),
    },
    {
      id: "app-connection",
      label: t("common.website_and_app_connection"),
      icon: <ListChecksIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/workspace/app-connection`,
      current: pathname?.includes("/app-connection"),
    },
    {
      id: "integrations",
      label: t("common.integrations"),
      icon: <BlocksIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/workspace/integrations`,
      current: pathname?.includes("/integrations"),
    },
    {
      id: "teams",
      label: t("common.team_access"),
      icon: <UsersIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/workspace/teams`,
      current: pathname?.includes("/teams"),
    },
    {
      id: "languages",
      label: t("common.survey_languages"),
      icon: <LanguagesIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/workspace/languages`,
      current: pathname?.includes("/languages"),
    },
    {
      id: "tags",
      label: t("common.tags"),
      icon: <TagIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/workspace/tags`,
      current: pathname?.includes("/tags"),
    },
    {
      id: "unify",
      label: t("environments.unify.unify_feedback"),
      icon: <Cable className="h-5 w-5" />,
      href: `/environments/${environmentId}/workspace/unify`,
      current: pathname?.includes("/unify"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
