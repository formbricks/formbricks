import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { getTranslations } from "next-intl/server";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { TProject } from "@formbricks/types/project";

interface PersonSecondaryNavigationProps {
  activeId: string;
  environmentId?: string;
  loading?: boolean;
}

export const PersonSecondaryNavigation = async ({
  activeId,
  environmentId,
  loading,
}: PersonSecondaryNavigationProps) => {
  let project: TProject | null = null;
  const t = await getTranslations();
  if (!loading && environmentId) {
    project = await getProjectByEnvironmentId(environmentId);

    if (!project) {
      throw new Error("Project not found");
    }
  }

  const navigation = [
    {
      id: "people",
      label: t("common.people"),
      href: `/environments/${environmentId}/people`,
    },
    {
      id: "segments",
      label: t("common.segments"),
      href: `/environments/${environmentId}/segments`,
    },
    {
      id: "attributes",
      label: t("common.attributes"),
      href: `/environments/${environmentId}/attributes`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
