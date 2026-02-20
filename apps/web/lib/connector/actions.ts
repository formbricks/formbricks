"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  TConnectorWithMappings,
  ZConnectorCreateInput,
  ZConnectorFieldMappingCreateInput,
  ZConnectorUpdateInput,
  getHubFieldTypeFromElementType,
} from "@formbricks/types/connector";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
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
  TMappingsInput,
  createConnectorWithMappings,
  deleteConnector,
  updateConnectorWithMappings,
} from "./service";

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

const resolveFormbricksMappingsInput = async (
  surveyId: string,
  elementIds: string[]
): Promise<TMappingsInput> => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  const elements = getElementsFromBlocks(survey.blocks);
  const elementMap = new Map(elements.map((el) => [el.id, el]));

  return {
    type: "formbricks",
    mappings: elementIds.map((elementId) => {
      const element = elementMap.get(elementId);
      return {
        surveyId,
        elementId,
        hubFieldType: getHubFieldTypeFromElementType(element?.type ?? "openText"),
      };
    }),
  };
};

const ZCreateConnectorWithMappingsAction = z.object({
  environmentId: ZId,
  connectorInput: ZConnectorCreateInput,
  formbricksMappings: z
    .object({
      surveyId: ZId,
      elementIds: z.array(z.string()).min(1),
    })
    .optional(),
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

      if (parsedInput.formbricksMappings) {
        mappingsInput = await resolveFormbricksMappingsInput(
          parsedInput.formbricksMappings.surveyId,
          parsedInput.formbricksMappings.elementIds
        );
      } else if (parsedInput.fieldMappings && parsedInput.fieldMappings.length > 0) {
        mappingsInput = { type: "field", mappings: parsedInput.fieldMappings };
      }

      return createConnectorWithMappings(
        parsedInput.environmentId,
        parsedInput.connectorInput,
        mappingsInput
      );
    }
  );

const ZUpdateConnectorWithMappingsAction = z.object({
  connectorId: ZId,
  connectorInput: ZConnectorUpdateInput,
  formbricksMappings: z
    .object({
      surveyId: ZId,
      elementIds: z.array(z.string()).min(1),
    })
    .optional(),
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

      if (parsedInput.formbricksMappings) {
        mappingsInput = await resolveFormbricksMappingsInput(
          parsedInput.formbricksMappings.surveyId,
          parsedInput.formbricksMappings.elementIds
        );
      } else if (parsedInput.fieldMappings && parsedInput.fieldMappings.length > 0) {
        mappingsInput = { type: "field", mappings: parsedInput.fieldMappings };
      }

      return updateConnectorWithMappings(parsedInput.connectorId, parsedInput.connectorInput, mappingsInput);
    }
  );
