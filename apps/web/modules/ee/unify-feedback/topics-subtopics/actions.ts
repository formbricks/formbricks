"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  createTaxonomyRun,
  getActiveTaxonomyTree,
  getTaxonomyRun,
  getTaxonomyTree,
  listTaxonomyFields,
  listTaxonomyNodeRecords,
  listTaxonomyRuns,
  removeTaxonomyNode,
  renameTaxonomyNode,
} from "@/modules/hub/service";
import type {
  TaxonomyFieldOption,
  TaxonomyNode,
  TaxonomyNodeRecordsResponse,
  TaxonomyRun,
  TaxonomyTreeResponse,
} from "@/modules/hub/types";

const ZTaxonomyScope = z.object({
  tenant_id: ZId,
  source_type: z.string().trim().min(1).max(255),
  source_id: z.string().trim().min(1).max(255),
  field_id: z.string().trim().min(1).max(255),
});

const ZWorkspaceDirectory = z.object({
  workspaceId: ZId,
  directoryId: ZId,
});

const ZScopedTaxonomyInput = z.object({
  workspaceId: ZId,
  scope: ZTaxonomyScope,
});

export type TTaxonomyFieldsActionResult = {
  fields: TaxonomyFieldOption[];
  unavailable: boolean;
  unavailableMessage?: string;
};

export type TTaxonomyStateActionResult = {
  activeTree: TaxonomyTreeResponse | null;
  runs: TaxonomyRun[];
  unavailable: boolean;
  unavailableMessage?: string;
};

const ensureAccess = async (
  userId: string,
  workspaceId: string,
  minPermission: "read" | "readWrite"
): Promise<void> => {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  const isFeedbackDirectoriesAllowed = await getIsFeedbackDirectoriesEnabled(organizationId);
  if (!isFeedbackDirectoriesAllowed) {
    throw new OperationNotAllowedError("Unify Feedback is not enabled for this organization");
  }

  await checkAuthorizationUpdated({
    userId,
    organizationId,
    access: [
      {
        type: "organization",
        roles: ["owner", "manager"],
      },
      {
        type: "workspaceTeam",
        minPermission,
        workspaceId,
      },
    ],
  });
};

const ensureDirectoryAccess = async (workspaceId: string, directoryId: string): Promise<void> => {
  const directories = await getFeedbackDirectoriesByWorkspaceId(workspaceId);
  if (!directories.some((directory) => directory.id === directoryId)) {
    throw new OperationNotAllowedError("Feedback directory is not assigned to this workspace");
  }
};

const unavailableResult = (message: string) => ({
  unavailable: true,
  unavailableMessage: message,
});

const hubErrorMessage = (message: string | undefined, fallback: string) => message || fallback;

export const getTaxonomyFieldsAction = authenticatedActionClient
  .inputSchema(ZWorkspaceDirectory)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZWorkspaceDirectory>;
    }): Promise<TTaxonomyFieldsActionResult> => {
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "read");
      await ensureDirectoryAccess(parsedInput.workspaceId, parsedInput.directoryId);

      const result = await listTaxonomyFields(parsedInput.directoryId);
      if (result.error) {
        return {
          fields: [],
          ...unavailableResult(hubErrorMessage(result.error.message, "Taxonomy fields are unavailable")),
        };
      }

      return { fields: result.data?.data ?? [], unavailable: false };
    }
  );

export const getTaxonomyStateAction = authenticatedActionClient
  .inputSchema(ZScopedTaxonomyInput)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZScopedTaxonomyInput>;
    }): Promise<TTaxonomyStateActionResult> => {
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "read");
      await ensureDirectoryAccess(parsedInput.workspaceId, parsedInput.scope.tenant_id);

      const [activeTree, runs] = await Promise.all([
        getActiveTaxonomyTree(parsedInput.scope),
        listTaxonomyRuns({ ...parsedInput.scope, limit: 5 }),
      ]);

      if (runs.error) {
        return {
          activeTree: null,
          runs: [],
          ...unavailableResult(hubErrorMessage(runs.error.message, "Taxonomy runs are unavailable")),
        };
      }

      return {
        activeTree: activeTree.error?.status === 404 ? null : activeTree.data,
        runs: runs.data?.data ?? [],
        unavailable: Boolean(activeTree.error && activeTree.error.status !== 404),
        unavailableMessage:
          activeTree.error && activeTree.error.status !== 404
            ? hubErrorMessage(activeTree.error.message, "Active taxonomy is unavailable")
            : undefined,
      };
    }
  );

export const triggerTaxonomyRunAction = authenticatedActionClient
  .inputSchema(
    ZScopedTaxonomyInput.extend({
      fieldLabel: z.string().trim().max(1000).optional(),
    })
  )
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZScopedTaxonomyInput> & { fieldLabel?: string };
    }): Promise<{ run: TaxonomyRun; inProgress: boolean }> => {
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "readWrite");
      await ensureDirectoryAccess(parsedInput.workspaceId, parsedInput.scope.tenant_id);

      const result = await createTaxonomyRun({
        ...parsedInput.scope,
        field_label: parsedInput.fieldLabel,
        actor_id: ctx.user.id,
      });
      if (result.error || !result.data) {
        throw new Error(hubErrorMessage(result.error?.message, "Failed to start taxonomy generation"));
      }

      return { run: result.data.run, inProgress: result.data.in_progress };
    }
  );

export const getTaxonomyRunAction = authenticatedActionClient
  .inputSchema(
    ZScopedTaxonomyInput.extend({
      runId: z.string().uuid(),
    })
  )
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZScopedTaxonomyInput> & { runId: string };
    }): Promise<TaxonomyRun> => {
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "read");
      await ensureDirectoryAccess(parsedInput.workspaceId, parsedInput.scope.tenant_id);

      const result = await getTaxonomyRun(parsedInput.runId, parsedInput.scope.tenant_id);
      if (result.error || !result.data) {
        throw new Error(hubErrorMessage(result.error?.message, "Failed to load taxonomy run"));
      }

      return result.data;
    }
  );

export const getTaxonomyTreeAction = authenticatedActionClient
  .inputSchema(
    ZScopedTaxonomyInput.extend({
      runId: z.string().uuid(),
    })
  )
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZScopedTaxonomyInput> & { runId: string };
    }): Promise<TaxonomyTreeResponse> => {
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "read");
      await ensureDirectoryAccess(parsedInput.workspaceId, parsedInput.scope.tenant_id);

      const result = await getTaxonomyTree(parsedInput.runId, parsedInput.scope.tenant_id);
      if (result.error || !result.data) {
        throw new Error(hubErrorMessage(result.error?.message, "Failed to load taxonomy tree"));
      }

      return result.data;
    }
  );

export const getTaxonomyNodeRecordsAction = authenticatedActionClient
  .inputSchema(
    z.object({
      workspaceId: ZId,
      tenantId: ZId,
      nodeId: z.string().uuid(),
      limit: z.number().min(1).max(100).optional(),
    })
  )
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: { workspaceId: string; tenantId: string; nodeId: string; limit?: number };
    }): Promise<TaxonomyNodeRecordsResponse> => {
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "read");
      await ensureDirectoryAccess(parsedInput.workspaceId, parsedInput.tenantId);

      const result = await listTaxonomyNodeRecords(parsedInput.nodeId, {
        tenant_id: parsedInput.tenantId,
        limit: parsedInput.limit,
      });
      if (result.error || !result.data) {
        throw new Error(hubErrorMessage(result.error?.message, "Failed to load node feedback records"));
      }

      return result.data;
    }
  );

export const renameTaxonomyNodeAction = authenticatedActionClient
  .inputSchema(
    z.object({
      workspaceId: ZId,
      tenantId: ZId,
      nodeId: z.string().uuid(),
      label: z.string().trim().min(1).max(1000),
    })
  )
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: { workspaceId: string; tenantId: string; nodeId: string; label: string };
    }): Promise<TaxonomyNode> => {
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "readWrite");
      await ensureDirectoryAccess(parsedInput.workspaceId, parsedInput.tenantId);

      const result = await renameTaxonomyNode(parsedInput.nodeId, {
        tenant_id: parsedInput.tenantId,
        actor_id: ctx.user.id,
        label: parsedInput.label,
      });
      if (result.error || !result.data) {
        throw new Error(hubErrorMessage(result.error?.message, "Failed to rename taxonomy node"));
      }

      return result.data;
    }
  );

export const removeTaxonomyNodeAction = authenticatedActionClient
  .inputSchema(
    z.object({
      workspaceId: ZId,
      tenantId: ZId,
      nodeId: z.string().uuid(),
    })
  )
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: { workspaceId: string; tenantId: string; nodeId: string };
    }): Promise<TaxonomyNode> => {
      await ensureAccess(ctx.user.id, parsedInput.workspaceId, "readWrite");
      await ensureDirectoryAccess(parsedInput.workspaceId, parsedInput.tenantId);

      const result = await removeTaxonomyNode(parsedInput.nodeId, {
        tenant_id: parsedInput.tenantId,
        actor_id: ctx.user.id,
      });
      if (result.error || !result.data) {
        throw new Error(hubErrorMessage(result.error?.message, "Failed to remove taxonomy node"));
      }

      return result.data;
    }
  );
