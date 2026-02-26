"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import {
  TConnectorWithMappings,
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
import { importHistoricalResponses } from "./import";
import {
  TMappingsInput,
  createConnectorWithMappings,
  deleteConnector,
  getConnectorWithMappingsById,
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
): Promise<{ surveyId: string; elementId: string; hubFieldType: string }[]> => {
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

const ZCreateConnectorWithMappingsAction = z.object({
  environmentId: ZId,
  connectorInput: ZConnectorCreateInput,
  formbricksMappings: z.array(ZFormbricksSurveyMapping).min(1).optional(),
  fieldMappings: z.array(ZConnectorFieldMappingCreateInput).optional(),
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
