"use client";

import { BlocksIcon, BrushIcon, LanguagesIcon, ListChecksIcon, TagIcon, UsersIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface WorkspaceConfigNavigationProps {
  activeId: string;
  loading?: boolean;
}

export const WorkspaceConfigNavigation = ({ activeId, loading }: WorkspaceConfigNavigationProps) => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const workspaceBasePath = `/workspaces/${workspace?.id}`;

  let navigation = [
    {
      id: "general",
      label: t("common.general"),
      icon: <UsersIcon className="h-5 w-5" />,
      href: `${workspaceBasePath}/general`,
      current: pathname?.includes("/general"),
    },
    {
      id: "look",
      label: t("common.look_and_feel"),
      icon: <BrushIcon className="h-5 w-5" />,
      href: `${workspaceBasePath}/look`,
      current: pathname?.includes("/look"),
    },
    {
      id: "app-connection",
      label: t("common.website_and_app_connection"),
      icon: <ListChecksIcon className="h-5 w-5" />,
      href: `${workspaceBasePath}/app-connection`,
      current: pathname?.includes("/app-connection"),
    },
    {
      id: "integrations",
      label: t("common.integrations"),
      icon: <BlocksIcon className="h-5 w-5" />,
      href: `${workspaceBasePath}/integrations`,
      current: pathname?.includes("/integrations"),
    },
    {
      id: "teams",
      label: t("common.team_access"),
      icon: <UsersIcon className="h-5 w-5" />,
      href: `${workspaceBasePath}/teams`,
      current: pathname?.includes("/teams"),
    },
    {
      id: "languages",
      label: t("common.survey_languages"),
      icon: <LanguagesIcon className="h-5 w-5" />,
      href: `${workspaceBasePath}/languages`,
      current: pathname?.includes("/languages"),
    },
    {
      id: "tags",
      label: t("common.tags"),
      icon: <TagIcon className="h-5 w-5" />,
      href: `${workspaceBasePath}/tags`,
      current: pathname?.includes("/tags"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
