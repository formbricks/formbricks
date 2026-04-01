import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TWorkspace } from "@formbricks/types/workspace";
import { getWorkspaceByEnvironmentId } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface PersonSecondaryNavigationProps {
  activeId: string;
  environmentId?: string;
  loading?: boolean;
}

export const ContactsSecondaryNavigation = async ({
  activeId,
  environmentId,
  loading,
}: PersonSecondaryNavigationProps) => {
  let workspace: TWorkspace | null = null;
  const t = await getTranslate();
  if (!loading && environmentId) {
    workspace = await getWorkspaceByEnvironmentId(environmentId);

    if (!workspace) {
      throw new ResourceNotFoundError(t("common.workspace"), null);
    }
  }

  const navigation = [
    {
      id: "contacts",
      label: t("common.contacts"),
      href: `/environments/${environmentId}/contacts`,
    },
    {
      id: "attributes",
      label: t("common.attributes"),
      href: `/environments/${environmentId}/attributes`,
    },
    {
      id: "segments",
      label: t("common.segments"),
      href: `/environments/${environmentId}/segments`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
