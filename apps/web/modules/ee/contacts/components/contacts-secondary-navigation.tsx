import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { getTranslations } from "next-intl/server";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
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
  const t = await getTranslations();
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
