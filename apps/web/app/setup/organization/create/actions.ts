"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getHasNoOrganizations } from "@/lib/instance/service";
import { createMembership } from "@/lib/membership/service";
import { createOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, groupIdentifyPostHog } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { DEFAULT_WORKSPACE_NAME } from "@/lib/workspace/constants";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";

const ZCreateOrganizationAction = z.object({
  organizationName: z.string(),
});

export const createOrganizationAction = authenticatedActionClient
  .inputSchema(ZCreateOrganizationAction)
  .action(
    withAuditLogging("created", "organization", async ({ ctx, parsedInput }) => {
      const hasNoOrganizations = await getHasNoOrganizations();
      const isMultiOrgEnabled = await getIsMultiOrgEnabled();

      if (!hasNoOrganizations && !isMultiOrgEnabled) {
        throw new OperationNotAllowedError("This action can only be performed on a fresh instance.");
      }

      const newOrganization = await createOrganization({
        name: parsedInput.organizationName,
      });

      await createMembership(newOrganization.id, ctx.user.id, {
        role: "owner",
        accepted: true,
      });

      // Stripe setup must run AFTER membership is created so the owner email is available
      if (IS_FORMBRICKS_CLOUD) {
        ensureCloudStripeSetupForOrganization(newOrganization.id).catch((error) => {
          logger.error(
            { error, organizationId: newOrganization.id },
            "Stripe setup failed after organization creation"
          );
        });
      }

      const newWorkspace = await createWorkspace(newOrganization.id, {
        name: DEFAULT_WORKSPACE_NAME,
      });

      ctx.auditLoggingCtx.organizationId = newOrganization.id;
      ctx.auditLoggingCtx.newObject = newOrganization;

      groupIdentifyPostHog("organization", newOrganization.id, {
        name: newOrganization.name,
        email_domain: ctx.user.email.split("@")[1],
      });
      groupIdentifyPostHog("workspace", newWorkspace.id, { name: newWorkspace.name });

      capturePostHogEvent(
        ctx.user.id,
        "organization_created",
        {
          organization_id: newOrganization.id,
          is_first_org: hasNoOrganizations,
        },
        { organizationId: newOrganization.id, workspaceId: newWorkspace.id }
      );

      capturePostHogEvent(
        ctx.user.id,
        "workspace_created",
        {
          organization_id: newOrganization.id,
          workspace_id: newWorkspace.id,
          name: newWorkspace.name,
        },
        { organizationId: newOrganization.id, workspaceId: newWorkspace.id }
      );

      return newOrganization;
    })
  );
