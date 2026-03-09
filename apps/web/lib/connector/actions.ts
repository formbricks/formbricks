"use server";

import { z } from "zod";
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
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromSurveyId,
  getProjectIdFromConnectorId,
  getProjectIdFromEnvironmentId,
} from "@/lib/utils/helper";
import { getTranslate } from "@/lingodotdev/server";
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
  environmentId: ZId,
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

      return deleteConnector(parsedInput.connectorId, parsedInput.environmentId);
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
  return { type: "formbricks", mappings: allMappings.flat() };
};

const ZFormbricksSurveyMapping = z.object({
  surveyId: ZId,
  elementIds: z.array(z.string()).min(1),
});

const ZCreateConnectorWithMappingsAction = z
  .object({
    environmentId: ZId,
    connectorInput: ZConnectorCreateInput,
    formbricksMappings: z.array(ZFormbricksSurveyMapping).optional(),
    fieldMappings: z.array(ZConnectorFieldMappingCreateInput).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.connectorInput.type === "formbricks") {
      if (!data.formbricksMappings?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["formbricksMappings"],
          message: "At least one survey mapping is required for Formbricks connectors",
        });
      }
    } else if (data.connectorInput.type === "csv") {
      if (!data.fieldMappings?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fieldMappings"],
          message: "At least one field mapping is required for CSV connectors",
        });
      }
    }
  });

export const createConnectorWithMappingsAction = authenticatedActionClient
  .schema(ZCreateConnectorWithMappingsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZCreateConnectorWithMappingsAction>;
    }): Promise<TConnectorWithMappings> => {
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
        parsedInput.environmentId,
        { ...parsedInput.connectorInput, createdBy: ctx.user.id },
        mappingsInput
      );
    }
  );

const ZUpdateConnectorWithMappingsAction = z.object({
  connectorId: ZId,
  environmentId: ZId,
  connectorInput: ZConnectorUpdateInput,
  formbricksMappings: z.array(ZFormbricksSurveyMapping).min(1).optional(),
  fieldMappings: z.array(ZConnectorFieldMappingCreateInput).optional(),
});

export const updateConnectorWithMappingsAction = authenticatedActionClient
  .schema(ZUpdateConnectorWithMappingsAction)
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
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
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
        parsedInput.environmentId,
        parsedInput.connectorInput,
        mappingsInput
      );
    }
  );

const ZDuplicateConnectorAction = z.object({
  connectorId: ZId,
  environmentId: ZId,
});

export const duplicateConnectorAction = authenticatedActionClient
  .schema(ZDuplicateConnectorAction)
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
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
          },
        ],
      });

      const source = await getConnectorWithMappingsById(parsedInput.connectorId, parsedInput.environmentId);
      if (!source) {
        throw new ResourceNotFoundError("Connector", parsedInput.connectorId);
      }

      let mappingsInput: TMappingsInput | undefined;

      if (source.type === "formbricks" && source.formbricksMappings.length > 0) {
        mappingsInput = {
          type: "formbricks",
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
        parsedInput.environmentId,
        { name: `${source.name} (copy)`, type: source.type, createdBy: ctx.user.id },
        mappingsInput
      );
    }
  );

const ZGetResponseCountAction = z.object({
  surveyId: ZId,
  environmentId: ZId,
});

export const getResponseCountAction = authenticatedActionClient
  .schema(ZGetResponseCountAction)
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
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
          },
        ],
      });

      return getResponseCountBySurveyId(parsedInput.surveyId);
    }
  );

const ZImportHistoricalResponsesAction = z.object({
  connectorId: ZId,
  environmentId: ZId,
  surveyId: ZId,
});

export const importHistoricalResponsesAction = authenticatedActionClient
  .schema(ZImportHistoricalResponsesAction)
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
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
          },
        ],
      });

      const connector = await getConnectorWithMappingsById(
        parsedInput.connectorId,
        parsedInput.environmentId
      );
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
  environmentId: ZId,
  csvData: z.array(z.record(z.string())).min(1),
});

export const importCsvDataAction = authenticatedActionClient
  .schema(ZImportCsvDataAction)
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
            type: "projectTeam",
            minPermission: "readWrite",
            projectId: await getProjectIdFromConnectorId(parsedInput.connectorId),
          },
        ],
      });

      const connector = await getConnectorWithMappingsById(
        parsedInput.connectorId,
        parsedInput.environmentId
      );
      if (!connector) {
        throw new ResourceNotFoundError("Connector", parsedInput.connectorId);
      }

      const result = await importCsvData(connector, parsedInput.csvData);

      if (result.successes > 0) {
        await updateConnector(parsedInput.connectorId, parsedInput.environmentId, {
          lastSyncAt: new Date(),
        });
      }

      return result;
    }
  );

const ZListFeedbackRecordsAction = z.object({
  environmentId: ZId,
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  sourceType: z.string().optional(),
  fieldType: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

export const listFeedbackRecordsAction = authenticatedActionClient
  .schema(ZListFeedbackRecordsAction)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZListFeedbackRecordsAction>;
    }): Promise<FeedbackRecordListResponse> => {
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
            minPermission: "read",
            projectId: await getProjectIdFromEnvironmentId(parsedInput.environmentId),
          },
        ],
      });

      const params: FeedbackRecordListParams = {
        tenant_id: parsedInput.environmentId,
        limit: parsedInput.limit ?? 50,
        offset: parsedInput.offset ?? 0,
      };
      if (parsedInput.sourceType) params.source_type = parsedInput.sourceType;
      if (parsedInput.fieldType) params.field_type = parsedInput.fieldType;
      if (parsedInput.since) params.since = parsedInput.since;
      if (parsedInput.until) params.until = parsedInput.until;

      const result = await listFeedbackRecords(params);
      if (result.error || !result.data) {
        logger.warn({ error: result.error }, "Failed to list feedback records");
        const t = await getTranslate();
        throw new Error(result.error?.message ?? t("environments.unify.failed_to_load_feedback_records"));
      }

      return result.data;
    }
  );
