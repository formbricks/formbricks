import "server-only";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurvey, TSurveyEnding } from "@formbricks/types/surveys/types";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import type { TV3SurveyDocument } from "./schemas";
import {
  V3_CONTACTS_NOT_ENABLED_MESSAGE,
  areV3SurveyTargetingFiltersEqual,
  resolveV3ContactsEntitlement,
} from "./targeting";

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
    return ending.url ?? null;
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

/**
 * Contact targeting (segment filters) is an enterprise feature. Only gate when the patch actually
 * changes the stored filters, so an unentitled organization can still patch other app-survey fields.
 */
export async function assertV3SurveyTargetingWritePermission(
  currentSurvey: TSurvey,
  document: TV3SurveyDocument,
  organizationId?: string
): Promise<void> {
  if (currentSurvey.type !== "app") {
    return;
  }

  const currentFilters = currentSurvey.segment?.filters ?? [];
  const nextFilters = document.targeting?.filters ?? [];
  if (areV3SurveyTargetingFiltersEqual(currentFilters, nextFilters)) {
    return;
  }

  const { resolvedOrganizationId, isContactsEnabled } = await resolveV3ContactsEntitlement(
    currentSurvey.workspaceId,
    organizationId
  );
  if (!resolvedOrganizationId) {
    throw new V3SurveyWritePermissionError(
      `Unable to verify contact targeting permissions for workspaceId: ${currentSurvey.workspaceId}`
    );
  }
  if (!isContactsEnabled) {
    throw new V3SurveyWritePermissionError(V3_CONTACTS_NOT_ENABLED_MESSAGE);
  }
}
