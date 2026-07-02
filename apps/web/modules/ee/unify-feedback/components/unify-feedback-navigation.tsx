"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";
import { Badge } from "@/modules/ui/components/badge";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface UnifyFeedbackNavigationProps {
  organizationId: string;
  loading?: boolean;
}

/**
 * Org-scoped secondary nav pairing the two Unify Feedback surfaces that share a dataset context:
 * Records and Topics. Replaces the old workspace-scoped Records|Topics config nav. Feedback Sources
 * stays a peer sidebar item and is intentionally not listed here.
 *
 * The active tab is derived from the pathname rather than a prop so both the Records and Topics pages
 * can drop this in without threading an activeId through their client trees.
 */
export const UnifyFeedbackNavigation = ({
  organizationId,
  loading,
}: Readonly<UnifyFeedbackNavigationProps>) => {
  const { t } = useTranslation();
  const pathname = usePathname();

  const topicsHref = organizationSettingsPath(organizationId, "unify-feedback/topics");
  const activeId = pathname?.includes(topicsHref) ? "topics" : "records";

  const navigation = [
    {
      id: "records",
      label: t("workspace.unify.feedback_records"),
      href: organizationSettingsPath(organizationId, "unify-feedback/datasets"),
    },
    {
      id: "topics",
      label: (
        <span className="inline-flex items-center gap-2">
          {t("workspace.unify.topics_and_subtopics")}
          <Badge text={t("common.preview")} type="gray" size="tiny" />
        </span>
      ),
      href: topicsHref,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
