"use client";

import { SparklesIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useDeploymentInfo,
  useWorkspace,
} from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import {
  AI_FEATURES_DOCS_URL,
  getAIUnavailableAction,
  getAIUnavailableActionLabel,
  getAIUnavailableMessage,
} from "@/lib/ai/availability";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { type ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

interface AIDisabledPromptProps {
  /** Names the blocked capability, e.g. "AI chart generation". The reason copy is shared. */
  title: string;
  reason?: TAIUnavailableReason;
  /** Distinguishes the surface in the `upgrade_cta_clicked` PostHog event. */
  feature: string;
}

/**
 * The single rendering of "AI smart tools are unavailable here". Every surface that gates on AI
 * shows this same block, so the reason copy and the upgrade target are resolved once
 * (`lib/ai/availability`) instead of per feature.
 */
export const AIDisabledPrompt = ({ title, reason, feature }: Readonly<AIDisabledPromptProps>) => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const deployment = useDeploymentInfo();

  const learnMoreButton: ModalButton = {
    text: t("common.learn_more"),
    href: AI_FEATURES_DOCS_URL,
  };

  // Both are needed to aim the CTA: the organization to link to, and whether this deployment
  // upgrades through billing or a licence request. Without them only the docs link is honest.
  const action =
    workspace?.organizationId && deployment
      ? getAIUnavailableAction(reason, workspace.organizationId, deployment)
      : undefined;

  const buttons: [ModalButton] | [ModalButton, ModalButton] = action
    ? [
        {
          text: getAIUnavailableActionLabel(action.type, t),
          href: action.href,
          isExternal: action.isExternal,
        },
        learnMoreButton,
      ]
    : [learnMoreButton];

  return (
    <UpgradePrompt
      title={title}
      description={getAIUnavailableMessage(reason, t)}
      buttons={buttons}
      // Without an action the only button is the docs link, and counting that as an upgrade click
      // would inflate the funnel.
      feature={action ? feature : undefined}
      icon={SparklesIcon}
    />
  );
};
