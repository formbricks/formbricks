"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  TConnector,
  TConnectorWithMappings,
  ZConnectorCreateInput,
  ZConnectorFieldMappingCreateInput,
  ZConnectorFormbricksMappingCreateInput,
  ZConnectorUpdateInput,
} from "@formbricks/types/connector";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import {
  getOrganizationIdFromConnectorId,
  getOrganizationIdFromEnvironmentId,
  getProjectIdFromConnectorId,
  getProjectIdFromEnvironmentId,
} from "@/lib/utils/helper";
import {
  createConnector,
  createFieldMappings,
  createFormbricksMappings,
  deleteConnector,
  deleteFieldMapping,
  deleteFormbricksMapping,
  getConnectorWithMappings,
  getConnectors,
  getConnectorsWithMappings,
  syncFieldMappings,
  syncFormbricksMappings,
  updateConnector,
} from "./service";

// Get all connectors for an environment
const ZGetConnectorsAction = z.object({
  environmentId: ZId,
});

export const getConnectorsAction = authenticatedActionClient
  .schema(ZGetConnectorsAction)
  .action(async ({ ctx, parsedInput }): Promise<TConnector[]> => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "member"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return getConnectors(parsedInput.environmentId);
  });

// Get all connectors with mappings for an environment
const ZGetConnectorsWithMappingsAction = z.object({
  environmentId: ZId,
});

export const getConnectorsWithMappingsAction = authenticatedActionClient
  .schema(ZGetConnectorsWithMappingsAction)
  .action(async ({ ctx, parsedInput }): Promise<TConnectorWithMappings[]> => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "member"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
        },
      ],
    });

    return getConnectorsWithMappings(parsedInput.environmentId);
  });

// Get a single connector with mappings
const ZGetConnectorWithMappingsAction = z.object({
  connectorId: ZId,
});

export const getConnectorWithMappingsAction = authenticatedActionClient
  .schema(ZGetConnectorWithMappingsAction)
  .action(async ({ ctx, parsedInput }): Promise<TConnectorWithMappings | null> => {
    const organizationId = await getOrganizationIdFromConnectorId(parsedInput.connectorId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "member"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
        },
      ],
    });

    return getConnectorWithMappings(parsedInput.connectorId);
  });

// Create a new connector
const ZCreateConnectorAction = z.object({
  environmentId: ZId,
  connectorInput: ZConnectorCreateInput,
});

export const createConnectorAction = authenticatedActionClient
  .schema(ZCreateConnectorAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZCreateConnectorAction>;
    }) => {
      const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
          },
        ],
      });

      return createConnector(parsedInput.environmentId, parsedInput.connectorInput);
    }
  );

// Update a connector
const ZUpdateConnectorAction = z.object({
  connectorId: ZId,
  connectorInput: ZConnectorUpdateInput,
});

export const updateConnectorAction = authenticatedActionClient
  .schema(ZUpdateConnectorAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZUpdateConnectorAction>;
    }) => {
      const organizationId = await getOrganizationIdFromConnectorId(parsedInput.connectorId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
          },
        ],
      });

      return updateConnector(parsedInput.connectorId, parsedInput.connectorInput);
    }
  );

// Delete a connector
const ZDeleteConnectorAction = z.object({
  connectorId: ZId,
});

export const deleteConnectorAction = authenticatedActionClient
  .schema(ZDeleteConnectorAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZDeleteConnectorAction>;
    }) => {
      const organizationId = await getOrganizationIdFromConnectorId(parsedInput.connectorId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
          },
        ],
      });

      return deleteConnector(parsedInput.connectorId);
    }
  );

// Create Formbricks mappings for a connector
const ZCreateFormbricksMappingsAction = z.object({
  connectorId: ZId,
  mappings: z.array(ZConnectorFormbricksMappingCreateInput),
});

export const createFormbricksMappingsAction = authenticatedActionClient
  .schema(ZCreateFormbricksMappingsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZCreateFormbricksMappingsAction>;
    }) => {
      const organizationId = await getOrganizationIdFromConnectorId(parsedInput.connectorId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
          },
        ],
      });

      return createFormbricksMappings(parsedInput.connectorId, parsedInput.mappings);
    }
  );

// Sync (replace) Formbricks mappings for a connector
const ZSyncFormbricksMappingsAction = z.object({
  connectorId: ZId,
  mappings: z.array(ZConnectorFormbricksMappingCreateInput),
});

export const syncFormbricksMappingsAction = authenticatedActionClient
  .schema(ZSyncFormbricksMappingsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZSyncFormbricksMappingsAction>;
    }) => {
      const organizationId = await getOrganizationIdFromConnectorId(parsedInput.connectorId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
          },
        ],
      });

      return syncFormbricksMappings(parsedInput.connectorId, parsedInput.mappings);
    }
  );

// Delete a Formbricks mapping
const ZDeleteFormbricksMappingAction = z.object({
  mappingId: ZId,
  connectorId: ZId, // For authorization
});

export const deleteFormbricksMappingAction = authenticatedActionClient
  .schema(ZDeleteFormbricksMappingAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZDeleteFormbricksMappingAction>;
    }) => {
      const organizationId = await getOrganizationIdFromConnectorId(parsedInput.connectorId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
          },
        ],
      });

      return deleteFormbricksMapping(parsedInput.mappingId);
    }
  );

// Create field mappings for a connector (webhook, csv, etc.)
const ZCreateFieldMappingsAction = z.object({
  connectorId: ZId,
  mappings: z.array(ZConnectorFieldMappingCreateInput),
});

export const createFieldMappingsAction = authenticatedActionClient
  .schema(ZCreateFieldMappingsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZCreateFieldMappingsAction>;
    }) => {
      const organizationId = await getOrganizationIdFromConnectorId(parsedInput.connectorId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
          },
        ],
      });

      return createFieldMappings(parsedInput.connectorId, parsedInput.mappings);
    }
  );

// Sync (replace) field mappings for a connector
const ZSyncFieldMappingsAction = z.object({
  connectorId: ZId,
  mappings: z.array(ZConnectorFieldMappingCreateInput),
});

export const syncFieldMappingsAction = authenticatedActionClient
  .schema(ZSyncFieldMappingsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZSyncFieldMappingsAction>;
    }) => {
      const organizationId = await getOrganizationIdFromConnectorId(parsedInput.connectorId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
          },
        ],
      });

      return syncFieldMappings(parsedInput.connectorId, parsedInput.mappings);
    }
  );

// Delete a field mapping
const ZDeleteFieldMappingAction = z.object({
  mappingId: ZId,
  connectorId: ZId, // For authorization
});

export const deleteFieldMappingAction = authenticatedActionClient
  .schema(ZDeleteFieldMappingAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZDeleteFieldMappingAction>;
    }) => {
      const organizationId = await getOrganizationIdFromConnectorId(parsedInput.connectorId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
          },
        ],
      });

      return deleteFieldMapping(parsedInput.mappingId);
    }
  );
