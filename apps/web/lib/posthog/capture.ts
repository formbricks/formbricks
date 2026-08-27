import "server-only";
import { logger } from "@formbricks/logger";
import { posthogServerClient } from "./server";

type PostHogEventProperties = Record<string, string | number | boolean | null | undefined>;

// Wider than PostHogEventProperties: identify calls occasionally carry a structured snapshot (e.g.
// organization_roles, see lib/posthog/organization-roles.ts) rather than flat scalars. Event
// properties stay scalar-only — see the event-tracking guide for why.
type PostHogPersonProperties = Record<
  string,
  string | number | boolean | null | undefined | Record<string, unknown>[]
>;

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

export function identifyPostHogPerson(distinctId: string, properties?: PostHogPersonProperties): void {
  if (!posthogServerClient) return;

  try {
    posthogServerClient.identify({ distinctId, properties });
  } catch (error) {
    logger.warn({ error }, "Failed to identify PostHog person");
  }
}

/**
 * Extracts the lowercased domain part of an email address for use as a PostHog
 * property. Returns undefined when the email has no domain part.
 */
export function getEmailDomain(email: string): string | undefined {
  return email.split("@")[1]?.toLowerCase() || undefined;
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
