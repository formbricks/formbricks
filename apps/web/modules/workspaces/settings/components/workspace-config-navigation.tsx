"use client";

import { BlocksIcon, BrushIcon, LanguagesIcon, TagIcon, UnplugIcon, UsersIcon } from "lucide-react";
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
      icon: <UsersIcon className="size-5" />,
      href: `${workspaceBasePath}/settings/workspace/general`,
      current: pathname?.includes("/general"),
    },
    {
      id: "look",
      label: t("common.appearance"),
      icon: <BrushIcon className="size-5" />,
      href: `${workspaceBasePath}/settings/workspace/look`,
      current: pathname?.includes("/look"),
    },
    {
      id: "app-connection",
      label: t("common.connect_your_app"),
      icon: <UnplugIcon className="size-5" />,
      href: `${workspaceBasePath}/settings/workspace/app-connection`,
      current: pathname?.includes("/app-connection"),
    },
    {
      id: "integrations",
      label: t("common.integrations"),
      icon: <BlocksIcon className="size-5" />,
      href: `${workspaceBasePath}/settings/workspace/integrations`,
      current: pathname?.includes("/integrations"),
    },
    {
      id: "teams",
      label: t("common.team_access"),
      icon: <UsersIcon className="size-5" />,
      href: `${workspaceBasePath}/settings/workspace/teams`,
      current: pathname?.includes("/teams"),
    },
    {
      id: "languages",
      label: t("common.survey_languages"),
      icon: <LanguagesIcon className="size-5" />,
      href: `${workspaceBasePath}/settings/workspace/languages`,
      current: pathname?.includes("/languages"),
    },
    {
      id: "tags",
      label: t("common.tags"),
      icon: <TagIcon className="size-5" />,
      href: `${workspaceBasePath}/settings/workspace/tags`,
      current: pathname?.includes("/tags"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
