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
  previewSurvey?: boolean;
}

export const CardlessPreviewLogo = ({
  workspaceLogo,
  workspaceId,
  surveyLogo,
  mountKey,
  onLogoClick,
  previewSurvey = true,
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

  // When the logo is clickable, render it inside a button with a non-linked logo variant to avoid
  // nesting interactive elements and to keep the action keyboard-accessible.
  const content = onLogoClick ? (
    <button type="button" onClick={onLogoClick} className="cursor-pointer text-left">
      <ClientLogo
        workspaceLogo={workspaceLogo}
        workspaceId={workspaceId}
        surveyLogo={surveyLogo}
        previewSurvey={previewSurvey}
        position="inline"
        disableLinks
      />
    </button>
  ) : (
    <ClientLogo
      workspaceLogo={workspaceLogo}
      workspaceId={workspaceId}
      surveyLogo={surveyLogo}
      previewSurvey={previewSurvey}
      position="inline"
      disableLinks={!previewSurvey}
    />
  );

  return createPortal(content, mountNode);
};
