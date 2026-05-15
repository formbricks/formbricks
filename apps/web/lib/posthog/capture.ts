import "server-only";
import { logger } from "@formbricks/logger";
import { posthogServerClient } from "./server";

type PostHogEventProperties = Record<string, string | number | boolean | null | undefined>;

export type PostHogGroupContext = {
  organizationId?: string;
  workspaceId?: string;
};

const buildGroups = (context?: PostHogGroupContext): Record<string, string> | undefined => {
  if (!context) return undefined;
  const groups: Record<string, string> = {};
  if (context.organizationId) groups.organization = context.organizationId;
  if (context.workspaceId) groups.workspace = context.workspaceId;
  return Object.keys(groups).length > 0 ? groups : undefined;
};

export function capturePostHogEvent(
  distinctId: string,
  eventName: string,
  properties?: PostHogEventProperties,
  groupContext?: PostHogGroupContext
): void {
  if (!posthogServerClient) return;

  try {
    posthogServerClient.capture({
      distinctId,
      event: eventName,
      properties: {
        ...properties,
        $lib: "posthog-node",
        source: "server",
      },
      groups: buildGroups(groupContext),
    });
  } catch (error) {
    logger.warn({ error, eventName }, "Failed to capture PostHog event");
  }
}

type PostHogGroupType = "organization" | "workspace";

export function groupIdentifyPostHog(
  groupType: PostHogGroupType,
  groupKey: string,
  properties?: Record<string, string | number | boolean | null | undefined>
): void {
  if (!posthogServerClient) return;

  try {
    posthogServerClient.groupIdentify({
      groupType,
      groupKey,
      properties,
    });
  } catch (error) {
    logger.warn({ error, groupType, groupKey }, "Failed to identify PostHog group");
  }
}
