import { getTranslate } from "@/lingodotdev/server";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface PersonSecondaryNavigationProps {
  activeId: string;
  workspaceId?: string;
  loading?: boolean;
}

export const ContactsSecondaryNavigation = async ({
  activeId,
  workspaceId,
  loading,
}: PersonSecondaryNavigationProps) => {
  const t = await getTranslate();

  const workspaceBasePath = `/workspaces/${workspaceId}`;

  const navigation = [
    {
      id: "contacts",
      label: t("common.contacts"),
      href: `${workspaceBasePath}/contacts`,
    },
    {
      id: "attributes",
      label: t("common.attributes"),
      href: `${workspaceBasePath}/attributes`,
    },
    {
      id: "segments",
      label: t("common.segments"),
      href: `${workspaceBasePath}/segments`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
