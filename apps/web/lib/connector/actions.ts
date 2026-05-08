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
import { AuthorizationError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
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
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { listFeedbackRecords } from "@/modules/hub/service";
import type { FeedbackRecordListParams, FeedbackRecordListResponse } from "@/modules/hub/types";
import { importCsvData } from "./csv-import";
import { sanitizeCsvFieldMappings } from "./csv-mapping";
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

  return elementIds.flatMap((elementId) => {
    const element = elementMap.get(elementId);
    if (!element) {
      logger.warn({ surveyId, elementId }, "Skipping unknown elementId when building connector mappings");
      return [];
    }

    const hubFieldType = getHubFieldTypeFromElementType(element.type);
    if (!hubFieldType) {
      logger.warn(
        { surveyId, elementId, elementType: element.type },
        "Skipping unmappable element type when building connector mappings"
      );
      return [];
    }

    return [{ surveyId, elementId, hubFieldType }];
  });
};

const resolveFormbricksMappingsInput = async (
  entries: { surveyId: string; elementIds: string[] }[]
): Promise<TMappingsInput> => {
  const allMappings = await Promise.all(
    entries.map(({ surveyId, elementIds }) => resolveSurveyMappings(surveyId, elementIds))
  );
  const flattenedMappings = allMappings.flat();
  if (flattenedMappings.length === 0) {
    throw new InvalidInputError("No supported survey questions selected for connector mapping");
  }

  return { type: "formbricks_survey", mappings: flattenedMappings };
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
    const frd = await prisma.feedbackDirectory.findUnique({
      where: { id: parsedInput.connectorInput.feedbackDirectoryId },
      select: { organizationId: true },
    });
    if (frd?.organizationId !== organizationId) {
      throw new AuthorizationError("Invalid feedback directory");
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
      mappingsInput = {
        type: "field",
        mappings:
          parsedInput.connectorInput.type === "csv"
            ? (sanitizeCsvFieldMappings(fieldMappings) ?? [])
            : fieldMappings,
      };
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
        const connector = await prisma.connector.findUnique({
          where: { id: parsedInput.connectorId, workspaceId: parsedInput.workspaceId },
          select: { type: true },
        });
        if (!connector) {
          throw new ResourceNotFoundError("Connector", parsedInput.connectorId);
        }

        mappingsInput = {
          type: "field",
          mappings:
            connector.type === "csv"
              ? (sanitizeCsvFieldMappings(parsedInput.fieldMappings) ?? [])
              : parsedInput.fieldMappings,
        };
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
        const projected = source.fieldMappings.map((m) => ({
          sourceFieldId: m.sourceFieldId,
          targetFieldId: m.targetFieldId,
          staticValue: m.staticValue ?? undefined,
        }));
        mappingsInput = {
          type: "field",
          mappings: source.type === "csv" ? (sanitizeCsvFieldMappings(projected) ?? []) : projected,
        };
      }

      return createConnectorWithMappings(
        parsedInput.workspaceId,
        {
          name: `${source.name} (copy)`,
          type: source.type,
          feedbackDirectoryId: source.feedbackDirectoryId,
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
  frdId: ZId,
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

      // Verify FRD belongs to workspace's accessible FRDs
      const frds = await getFeedbackDirectoriesByWorkspaceId(parsedInput.workspaceId);
      if (!frds.some((f) => f.id === parsedInput.frdId)) {
        throw new Error("Feedback directory not accessible");
      }

      const params: FeedbackRecordListParams = {
        tenant_id: parsedInput.frdId,
        limit: parsedInput.limit ?? 50,
      };
      if (parsedInput.cursor) params.cursor = parsedInput.cursor;
      if (parsedInput.sourceType) params.source_type = parsedInput.sourceType;
      if (parsedInput.fieldType) params.field_type = parsedInput.fieldType;
      if (parsedInput.since) params.since = parsedInput.since;
      if (parsedInput.until) params.until = parsedInput.until;

      const result = await listFeedbackRecords(params);
      if (result.error || !result.data) {
        logger.warn({ error: result.error }, "Failed to list feedback records");
        throw new Error(result.error?.message ?? "Failed to load feedback records");
      }

      return result.data;
    }
  );
