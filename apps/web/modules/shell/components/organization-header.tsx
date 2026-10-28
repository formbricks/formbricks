import { getTranslate } from "@/lingodotdev/server";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

export type OrganizationSectionId = "members" | "teams" | "workspaces" | "security" | "billing";

/**
 * Heading and tab bar shared by the organization pages. The billing role only sees the billing tab.
 */
export const OrganizationHeader = async ({
  organizationId,
  activeId,
  isBilling,
}: Readonly<{ organizationId: string; activeId: OrganizationSectionId; isBilling: boolean }>) => {
  const t = await getTranslate();
  const base = `/organizations/${organizationId}`;

  const navigation = [
    { id: "members", label: t("common.members"), href: `${base}/members`, hidden: isBilling },
    { id: "teams", label: t("common.teams"), href: `${base}/teams`, hidden: isBilling },
    { id: "workspaces", label: t("common.workspaces"), href: `${base}/workspaces`, hidden: isBilling },
    { id: "security", label: t("common.security"), href: `${base}/security`, hidden: isBilling },
    { id: "billing", label: t("common.billing"), href: `${base}/billing` },
  ];

  return (
    <PageHeader pageTitle={t("common.organization")}>
      <SecondaryNavigation
        navigation={navigation}
        activeId={activeId}
        ariaLabel={t("shell.organization.sections")}
      />
    </PageHeader>
  );
};
