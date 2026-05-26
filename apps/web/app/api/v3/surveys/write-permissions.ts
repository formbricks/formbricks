import "server-only";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurveyEnding } from "@formbricks/types/surveys/types";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";

type TV3SurveyWritePermissionInput = {
  workspaceId: string;
  blocks: TSurveyBlock[];
  endings: TSurveyEnding[];
  previous?: {
    blocks: TSurveyBlock[];
    endings: TSurveyEnding[];
  };
};

export class V3SurveyWritePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "V3SurveyWritePermissionError";
  }
}

function getEndingExternalUrl(ending: TSurveyEnding): string | null {
  if (ending.type === "endScreen") {
    return ending.buttonLink ?? null;
  }

  if (ending.type === "redirectToUrl") {
    return ending.url;
  }

  return null;
}

function hasNewOrChangedExternalUrlReferences(input: TV3SurveyWritePermissionInput): boolean {
  for (const ending of input.endings) {
    const externalUrl = getEndingExternalUrl(ending);
    if (!externalUrl) {
      continue;
    }

    const previousEnding = input.previous?.endings.find((entry) => entry.id === ending.id);
    if (!previousEnding || getEndingExternalUrl(previousEnding) !== externalUrl) {
      return true;
    }
  }

  const elements = getElementsFromBlocks(input.blocks);
  const previousElements = input.previous ? getElementsFromBlocks(input.previous.blocks) : [];
  for (const element of elements) {
    if (element.type !== "cta" || !element.buttonExternal) {
      continue;
    }

    const previousElement = previousElements.find((entry) => entry.id === element.id);
    if (
      previousElement?.type !== "cta" ||
      !previousElement.buttonExternal ||
      previousElement.buttonUrl !== element.buttonUrl
    ) {
      return true;
    }
  }

  return false;
}

export async function assertV3SurveyWritePermissions(
  input: TV3SurveyWritePermissionInput,
  organizationId?: string
): Promise<void> {
  if (!hasNewOrChangedExternalUrlReferences(input)) {
    return;
  }

  const resolvedOrganizationId =
    organizationId ?? (await getOrganizationByWorkspaceId(input.workspaceId))?.id ?? null;
  if (!resolvedOrganizationId) {
    throw new V3SurveyWritePermissionError(
      `Unable to verify external URL permissions for workspaceId: ${input.workspaceId}`
    );
  }

  const isExternalUrlsAllowed = await getExternalUrlsPermission(resolvedOrganizationId);
  if (!isExternalUrlsAllowed) {
    throw new V3SurveyWritePermissionError(
      "External URLs are not enabled for this organization. Upgrade to use external survey links."
    );
  }
}
