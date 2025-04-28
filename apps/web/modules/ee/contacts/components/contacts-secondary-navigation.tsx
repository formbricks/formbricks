import { getProjectByEnvironmentId } from "@/lib/project/service";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { getTranslate } from "@/tolgee/server";
import { TProject } from "@formbricks/types/project";

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
  let project: TProject | null = null;
  const t = await getTranslate();
  if (!loading && environmentId) {
    project = await getProjectByEnvironmentId(environmentId);

    if (!project) {
      throw new Error(t("common.project_not_found"));
    }
  }

  const navigation = [
    {
      id: "contacts",
      label: t("common.contacts"),
      href: `/environments/${environmentId}/contacts`,
    },
    {
      id: "segments",
      label: t("common.segments"),
      href: `/environments/${environmentId}/segments`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
