"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Workspace } from "@formbricks/database/prisma-browser";
import { TLogo } from "@formbricks/types/styling";
import { ClientLogo } from "@/modules/ui/components/client-logo";

const CARDLESS_PREVIEW_LOGO_SLOT_ID = "formbricks-cardless-preview-logo-slot";

interface CardlessPreviewLogoProps {
  workspaceLogo: Workspace["logo"] | null;
  workspaceId: string;
  surveyLogo?: TLogo | null;
  mountKey?: string | number;
  onLogoClick?: () => void;
}

export const CardlessPreviewLogo = ({
  workspaceLogo,
  workspaceId,
  surveyLogo,
  mountKey,
  onLogoClick,
}: Readonly<CardlessPreviewLogoProps>) => {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const findSlot = () => document.getElementById(CARDLESS_PREVIEW_LOGO_SLOT_ID);

    const updateMountNode = () => {
      const slot = findSlot();
      setMountNode(slot);
    };

    updateMountNode();

    const observer = new MutationObserver(updateMountNode);
    const root = document.getElementById("survey-preview") ?? document.body;
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [mountKey]);

  if (!mountNode) {
    return null;
  }

  const logo = (
    <ClientLogo
      workspaceLogo={workspaceLogo}
      workspaceId={workspaceId}
      surveyLogo={surveyLogo}
      previewSurvey
      position="inline"
    />
  );

  return createPortal(
    onLogoClick ? (
      <div role="presentation" onClick={onLogoClick} className="cursor-pointer text-left">
        {logo}
      </div>
    ) : (
      logo
    ),
    mountNode
  );
};
