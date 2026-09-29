"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";
import {
  useDeploymentInfo,
  useWorkspace,
} from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import {
  getAIUnavailableAction,
  getAIUnavailableActionLabel,
  getAIUnavailableMessage,
} from "@/lib/ai/availability";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";

interface AIUnavailableAlertProps {
  /** Names the blocked capability, e.g. "AI chart generation". The reason copy is shared. */
  title: string;
  reason?: TAIUnavailableReason;
  /** Distinguishes the surface in the `upgrade_cta_clicked` PostHog event. */
  feature: string;
}

/**
 * The one way to say "AI smart tools are unavailable here". Every surface that gates on AI shows this
 * same alert, so the reason copy and the action behind it are resolved once (`lib/ai/availability`)
 * instead of per feature.
 */
export const AIUnavailableAlert = ({ title, reason, feature }: Readonly<AIUnavailableAlertProps>) => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const deployment = useDeploymentInfo();

  // Both are needed to aim the action: the organization to link to, and whether this deployment
  // upgrades through billing or a licence request.
  const action =
    workspace?.organizationId && deployment
      ? getAIUnavailableAction(reason, workspace.organizationId, deployment)
      : undefined;

  // Only a plan change is a conversion; switching a setting back on is not, so it stays untracked.
  const handleClick = () => {
    if (posthog.__loaded && action && action.type !== "enable_ai") {
      posthog.capture("upgrade_cta_clicked", { feature });
    }
  };

  return (
    <Alert variant="info" role="status">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{getAIUnavailableMessage(reason, t)}</AlertDescription>
      {action && (
        <AlertButton asChild>
          <Link
            href={action.href}
            onClick={handleClick}
            {...(action.isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {getAIUnavailableActionLabel(action.type, t)}
          </Link>
        </AlertButton>
      )}
    </Alert>
  );
};
