"use server";

import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import {
  TConnectorWithMappings,
  THubFieldType,
  ZConnectorCreateInput,
  ZConnectorFieldMappingCreateInput,
  ZConnectorUpdateInput,
  getHubFieldTypeFromElementType,
} from "@formbricks/types/connector";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import {
  getOrganizationIdFromConnectorId,
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
} from "@/lib/utils/helper";
import { getFeedbackRecordDirectoriesByWorkspaceId } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { listFeedbackRecords } from "@/modules/hub/service";
import type { FeedbackRecordListParams, FeedbackRecordListResponse } from "@/modules/hub/types";
import { importCsvData } from "./csv-import";
import { importHistoricalResponses } from "./import";
import {
  TMappingsInput,
  createConnectorWithMappings,
  deleteConnector,
  getConnectorWithMappingsById,
  updateConnector,
  updateConnectorWithMappings,
} from "./service";

const ZDeleteConnectorAction = z.object({
  connectorId: ZId,
  workspaceId: ZId,
});

export const deleteConnectorAction = authenticatedActionClient
  .inputSchema(ZDeleteConnectorAction)
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
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      return deleteConnector(parsedInput.connectorId, parsedInput.workspaceId);
    }
  );

const resolveSurveyMappings = async (
  surveyId: string,
  elementIds: string[]
): Promise<{ surveyId: string; elementId: string; hubFieldType: THubFieldType }[]> => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  const elements = getElementsFromBlocks(survey.blocks);
  const elementMap = new Map(elements.map((el) => [el.id, el]));

  return elementIds
    .filter((elementId) => {
      if (elementMap.has(elementId)) return true;
      logger.warn({ surveyId, elementId }, "Skipping unknown elementId when building connector mappings");
      return false;
    })
    .map((elementId) => {
      const element = elementMap.get(elementId)!;
      return {
        surveyId,
        elementId,
        hubFieldType: getHubFieldTypeFromElementType(element.type),
      };
    });
};

const resolveFormbricksMappingsInput = async (
  entries: { surveyId: string; elementIds: string[] }[]
): Promise<TMappingsInput> => {
  const allMappings = await Promise.all(
    entries.map(({ surveyId, elementIds }) => resolveSurveyMappings(surveyId, elementIds))
  );
  return { type: "formbricks_survey", mappings: allMappings.flat() };
};

const ZFormbricksSurveyMapping = z.object({
  surveyId: ZId,
  elementIds: z.array(z.string()).min(1),
});

const ZCreateConnectorWithMappingsAction = z
  .object({
    workspaceId: ZId,
    connectorInput: ZConnectorCreateInput,
    formbricksMappings: z.array(ZFormbricksSurveyMapping).optional(),
    fieldMappings: z.array(ZConnectorFieldMappingCreateInput).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.connectorInput.type === "formbricks_survey") {
      if (!data.formbricksMappings?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["formbricksMappings"],
          message: "At least one survey mapping is required for Formbricks connectors",
        });
      }
    } else if (data.connectorInput.type === "csv") {
      if (!data.fieldMappings?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["fieldMappings"],
          message: "At least one field mapping is required for CSV connectors",
        });
      }
    }
  });

export const createConnectorWithMappingsAction = authenticatedActionClient
  .inputSchema(ZCreateConnectorWithMappingsAction)
  .action(async ({ ctx, parsedInput }): Promise<TConnectorWithMappings> => {
    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId: parsedInput.workspaceId,
        },
      ],
    });

    // Verify FRD belongs to same org
    const frd = await prisma.feedbackRecordDirectory.findUnique({
      where: { id: parsedInput.connectorInput.feedbackRecordDirectoryId },
      select: { organizationId: true },
    });
    if (frd?.organizationId !== organizationId) {
      throw new AuthorizationError("Invalid feedback record directory");
    }

    let mappingsInput: TMappingsInput | undefined;

    const { formbricksMappings, fieldMappings } = parsedInput;

    if (formbricksMappings?.length) {
      await Promise.all(
        formbricksMappings.map(async ({ surveyId }) => {
          const orgId = await getOrganizationIdFromSurveyId(surveyId);
          if (orgId !== organizationId) {
            throw new AuthorizationError("You are not authorized to access this survey");
          }
        })
      );

      mappingsInput = await resolveFormbricksMappingsInput(formbricksMappings);
    } else if (fieldMappings?.length) {
      mappingsInput = { type: "field", mappings: fieldMappings };
    }

    return createConnectorWithMappings(
      parsedInput.workspaceId,
      { ...parsedInput.connectorInput, createdBy: ctx.user.id },
      mappingsInput
    );
  });

const ZUpdateConnectorWithMappingsAction = z.object({
  connectorId: ZId,
  workspaceId: ZId,
  connectorInput: ZConnectorUpdateInput,
  formbricksMappings: z.array(ZFormbricksSurveyMapping).min(1).optional(),
  fieldMappings: z.array(ZConnectorFieldMappingCreateInput).optional(),
});

export const updateConnectorWithMappingsAction = authenticatedActionClient
  .inputSchema(ZUpdateConnectorWithMappingsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZUpdateConnectorWithMappingsAction>;
    }): Promise<TConnectorWithMappings> => {
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
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      let mappingsInput: TMappingsInput | undefined;

      if (parsedInput.formbricksMappings?.length) {
        await Promise.all(
          parsedInput.formbricksMappings.map(async ({ surveyId }) => {
            const orgId = await getOrganizationIdFromSurveyId(surveyId);
            if (orgId !== organizationId) {
              throw new AuthorizationError("You are not authorized to access this survey");
            }
          })
        );

        mappingsInput = await resolveFormbricksMappingsInput(parsedInput.formbricksMappings);
      } else if (parsedInput.fieldMappings && parsedInput.fieldMappings.length > 0) {
        mappingsInput = { type: "field", mappings: parsedInput.fieldMappings };
      }

      return updateConnectorWithMappings(
        parsedInput.connectorId,
        parsedInput.workspaceId,
        parsedInput.connectorInput,
        mappingsInput
      );
    }
  );

const ZDuplicateConnectorAction = z.object({
  connectorId: ZId,
  workspaceId: ZId,
});

export const duplicateConnectorAction = authenticatedActionClient
  .inputSchema(ZDuplicateConnectorAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZDuplicateConnectorAction>;
    }): Promise<TConnectorWithMappings> => {
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
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      const source = await getConnectorWithMappingsById(parsedInput.connectorId, parsedInput.workspaceId);
      if (!source) {
        throw new ResourceNotFoundError("Connector", parsedInput.connectorId);
      }

      let mappingsInput: TMappingsInput | undefined;

      if (source.type === "formbricks_survey" && source.formbricksMappings.length > 0) {
        mappingsInput = {
          type: "formbricks_survey",
          mappings: source.formbricksMappings.map((m) => ({
            surveyId: m.surveyId,
            elementId: m.elementId,
            hubFieldType: m.hubFieldType,
            customFieldLabel: m.customFieldLabel ?? undefined,
          })),
        };
      } else if (source.fieldMappings.length > 0) {
        mappingsInput = {
          type: "field",
          mappings: source.fieldMappings.map((m) => ({
            sourceFieldId: m.sourceFieldId,
            targetFieldId: m.targetFieldId,
            staticValue: m.staticValue ?? undefined,
          })),
        };
      }

      return createConnectorWithMappings(
        parsedInput.workspaceId,
        {
          name: `${source.name} (copy)`,
          type: source.type,
          feedbackRecordDirectoryId: source.feedbackRecordDirectoryId,
          createdBy: ctx.user.id,
        },
        mappingsInput
      );
    }
  );

const ZGetResponseCountAction = z.object({
  surveyId: ZId,
  workspaceId: ZId,
});

export const getResponseCountAction = authenticatedActionClient
  .inputSchema(ZGetResponseCountAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZGetResponseCountAction>;
    }): Promise<number> => {
      const organizationId = await getOrganizationIdFromSurveyId(parsedInput.surveyId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      return getResponseCountBySurveyId(parsedInput.surveyId);
    }
  );

const ZImportHistoricalResponsesAction = z.object({
  connectorId: ZId,
  workspaceId: ZId,
  surveyId: ZId,
});

export const importHistoricalResponsesAction = authenticatedActionClient
  .inputSchema(ZImportHistoricalResponsesAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZImportHistoricalResponsesAction>;
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
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      const connector = await getConnectorWithMappingsById(parsedInput.connectorId, parsedInput.workspaceId);
      if (!connector) {
        throw new ResourceNotFoundError("Connector", parsedInput.connectorId);
      }

      const survey = await getSurvey(parsedInput.surveyId);
      if (!survey) {
        throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
      }

      return importHistoricalResponses(connector, survey);
    }
  );

const ZImportCsvDataAction = z.object({
  connectorId: ZId,
  workspaceId: ZId,
  csvData: z.array(z.record(z.string(), z.string())).min(1),
});

export const importCsvDataAction = authenticatedActionClient
  .inputSchema(ZImportCsvDataAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZImportCsvDataAction>;
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
            type: "workspaceTeam",
            minPermission: "readWrite",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      const connector = await getConnectorWithMappingsById(parsedInput.connectorId, parsedInput.workspaceId);
      if (!connector) {
        throw new ResourceNotFoundError("Connector", parsedInput.connectorId);
      }

      const result = await importCsvData(connector, parsedInput.csvData);

      if (result.successes > 0) {
        await updateConnector(parsedInput.connectorId, parsedInput.workspaceId, {
          lastSyncAt: new Date(),
        });
      }

      return result;
    }
  );

const ZListFeedbackRecordsAction = z.object({
  workspaceId: ZId,
  limit: z.number().min(1).max(1000).optional(),
  cursor: z.string().optional(),
  sourceType: z.string().optional(),
  fieldType: z
    .enum(["text", "categorical", "nps", "csat", "ces", "rating", "number", "boolean", "date"])
    .optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

export const listFeedbackRecordsAction = authenticatedActionClient
  .inputSchema(ZListFeedbackRecordsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZListFeedbackRecordsAction>;
    }): Promise<FeedbackRecordListResponse> => {
      const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "workspaceTeam",
            minPermission: "read",
            workspaceId: parsedInput.workspaceId,
          },
        ],
      });

      // tenant_id = FRD id. Fan out across all FRDs assigned to this workspace, merge + sort desc.
      const frds = await getFeedbackRecordDirectoriesByWorkspaceId(parsedInput.workspaceId);
      if (frds.length === 0) {
        return { data: [], limit: parsedInput.limit ?? 50 };
      }

      const perFrdLimit = parsedInput.limit ?? 50;
      const baseParams = {
        limit: perFrdLimit,
        ...(parsedInput.sourceType ? { source_type: parsedInput.sourceType } : {}),
        ...(parsedInput.fieldType ? { field_type: parsedInput.fieldType } : {}),
        ...(parsedInput.since ? { since: parsedInput.since } : {}),
        ...(parsedInput.until ? { until: parsedInput.until } : {}),
      };

      const results = await Promise.all(
        frds.map((frd) =>
          listFeedbackRecords({ ...baseParams, tenant_id: frd.id } as FeedbackRecordListParams)
        )
      );

      const errored = results.find((r) => r.error);
      if (errored?.error) {
        logger.warn({ error: errored.error }, "Failed to list feedback records");
        throw new Error(errored.error.message);
      }

      const merged = results
        .flatMap((r) => r.data?.data ?? [])
        .sort((a, b) => (a.collected_at < b.collected_at ? 1 : -1))
        .slice(0, perFrdLimit);

      return { data: merged, limit: perFrdLimit };
    }
  );
