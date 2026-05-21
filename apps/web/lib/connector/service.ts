import "server-only";
import { Prisma } from "@prisma/client";
import type { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import {
  TConnector,
  TConnectorCreateInput,
  TConnectorFieldMappingCreateInput,
  TConnectorFormbricksMappingCreateInput,
  TConnectorUpdateInput,
  TConnectorWithMappings,
  ZConnectorCreateInput,
  ZConnectorUpdateInput,
} from "@formbricks/types/connector";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";

const selectConnectorWithMappings = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  status: true,
  workspaceId: true,
  feedbackDirectoryId: true,
  lastSyncAt: true,
  createdBy: true,
  creator: { select: { name: true } },
  formbricksMappings: {
    select: {
      id: true,
      createdAt: true,
      connectorId: true,
      workspaceId: true,
      surveyId: true,
      elementId: true,
      hubFieldType: true,
      customFieldLabel: true,
    },
  },
  fieldMappings: {
    select: {
      id: true,
      createdAt: true,
      connectorId: true,
      workspaceId: true,
      sourceFieldId: true,
      targetFieldId: true,
      staticValue: true,
    },
  },
} satisfies Prisma.ConnectorSelect;

const selectConnector = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  status: true,
  workspaceId: true,
  feedbackDirectoryId: true,
  lastSyncAt: true,
  createdBy: true,
} satisfies Prisma.ConnectorSelect;

type PrismaConnectorWithCreator = Prisma.ConnectorGetPayload<{ select: typeof selectConnectorWithMappings }>;

const mapConnectorWithMappings = (connector: PrismaConnectorWithCreator): TConnectorWithMappings => {
  const { creator, ...rest } = connector;
  return { ...rest, creatorName: creator?.name ?? null } as TConnectorWithMappings;
};

export const getConnectorsWithMappings = reactCache(
  async (workspaceId: string, page?: number): Promise<TConnectorWithMappings[]> => {
    validateInputs([workspaceId, ZId], [page, ZOptionalNumber]);

    try {
      const connectors = await prisma.connector.findMany({
        where: {
          workspaceId,
        },
        select: selectConnectorWithMappings,
        orderBy: {
          createdAt: "desc",
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });

      return connectors.map(mapConnectorWithMappings);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getConnectorWithMappingsById = reactCache(
  async (connectorId: string, workspaceId: string): Promise<TConnectorWithMappings | null> => {
    validateInputs([connectorId, ZId], [workspaceId, ZId]);

    try {
      const connector = await prisma.connector.findUnique({
        where: {
          id: connectorId,
          workspaceId,
        },
        select: selectConnectorWithMappings,
      });

      return connector ? mapConnectorWithMappings(connector) : null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getConnectorsBySurveyId = reactCache(
  async (surveyId: string): Promise<TConnectorWithMappings[]> => {
    validateInputs([surveyId, ZId]);

    try {
      const connectors = await prisma.connector.findMany({
        where: {
          type: "formbricks_survey",
          status: "active",
          formbricksMappings: {
            some: {
              surveyId,
            },
          },
        },
        select: selectConnectorWithMappings,
      });

      return connectors.map(mapConnectorWithMappings);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const updateConnector = async (
  connectorId: string,
  workspaceId: string,
  data: TConnectorUpdateInput
): Promise<TConnector> => {
  validateInputs([connectorId, ZId], [data, ZConnectorUpdateInput], [workspaceId, ZId]);

  try {
    const connector = await prisma.connector.update({
      where: {
        id: connectorId,
        workspaceId,
      },
      data: {
        name: data.name,
        status: data.status,
        lastSyncAt: data.lastSyncAt,
      },
      select: selectConnector,
    });

    return connector as TConnector;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordDoesNotExist) {
        throw new ResourceNotFoundError("Connector", connectorId);
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteConnector = async (connectorId: string, workspaceId: string): Promise<TConnector> => {
  validateInputs([connectorId, ZId], [workspaceId, ZId]);

  try {
    const connector = await prisma.connector.delete({
      where: {
        id: connectorId,
        workspaceId,
      },
      select: selectConnector,
    });

    return connector as TConnector;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordDoesNotExist) {
        throw new ResourceNotFoundError("Connector", connectorId);
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

// -- Composite functions --

const mapUniqueConstraintError = (error: PrismaClientKnownRequestError): InvalidInputError => {
  const target = error.meta?.target;
  const targetFields = Array.isArray(target) ? (target as string[]) : [];
  if (targetFields.includes("elementId") || targetFields.includes("surveyId")) {
    return new InvalidInputError("CONNECTOR_FORMBRICKS_MAPPING_DUPLICATE");
  }
  if (targetFields.includes("sourceFieldId") || targetFields.includes("targetFieldId")) {
    return new InvalidInputError("CONNECTOR_FIELD_MAPPING_DUPLICATE");
  }
  return new InvalidInputError("CONNECTOR_NAME_DUPLICATE");
};

export type TFormbricksMappingsInput = {
  type: "formbricks_survey";
  mappings: TConnectorFormbricksMappingCreateInput[];
};

export type TFieldMappingsInput = {
  type: "field";
  mappings: TConnectorFieldMappingCreateInput[];
};

export type TMappingsInput = TFormbricksMappingsInput | TFieldMappingsInput;

export const createConnectorWithMappings = async (
  workspaceId: string,
  data: TConnectorCreateInput,
  mappingsInput?: TMappingsInput
): Promise<TConnectorWithMappings> => {
  validateInputs([workspaceId, ZId], [data, ZConnectorCreateInput]);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const connector = await tx.connector.create({
        data: {
          name: data.name,
          type: data.type,
          workspaceId,
          feedbackDirectoryId: data.feedbackDirectoryId,
          createdBy: data.createdBy,
        },
      });

      if (mappingsInput?.type === "formbricks_survey") {
        await Promise.all(
          mappingsInput.mappings.map((mapping) =>
            tx.connectorFormbricksMapping.create({
              data: {
                connectorId: connector.id,
                workspaceId,
                surveyId: mapping.surveyId,
                elementId: mapping.elementId,
                hubFieldType: mapping.hubFieldType,
                customFieldLabel: mapping.customFieldLabel,
              },
            })
          )
        );
      } else if (mappingsInput?.type === "field") {
        await Promise.all(
          mappingsInput.mappings.map((mapping) =>
            tx.connectorFieldMapping.create({
              data: {
                connectorId: connector.id,
                workspaceId,
                sourceFieldId: mapping.sourceFieldId,
                targetFieldId: mapping.targetFieldId,
                staticValue: mapping.staticValue,
              },
            })
          )
        );
      }

      return tx.connector.findUniqueOrThrow({
        where: { id: connector.id },
        select: selectConnectorWithMappings,
      });
    });

    return mapConnectorWithMappings(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw mapUniqueConstraintError(error);
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateConnectorWithMappings = async (
  connectorId: string,
  workspaceId: string,
  data: TConnectorUpdateInput,
  mappingsInput?: TMappingsInput
): Promise<TConnectorWithMappings> => {
  validateInputs([connectorId, ZId], [data, ZConnectorUpdateInput], [workspaceId, ZId]);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.connector.update({
        where: { id: connectorId, workspaceId },
        data: {
          name: data.name,
          status: data.status,
          lastSyncAt: data.lastSyncAt,
        },
      });

      if (mappingsInput?.type === "formbricks_survey") {
        await tx.connectorFormbricksMapping.deleteMany({
          where: { connectorId, workspaceId },
        });

        await Promise.all(
          mappingsInput.mappings.map((mapping) =>
            tx.connectorFormbricksMapping.create({
              data: {
                connectorId,
                workspaceId,
                surveyId: mapping.surveyId,
                elementId: mapping.elementId,
                hubFieldType: mapping.hubFieldType,
                customFieldLabel: mapping.customFieldLabel,
              },
            })
          )
        );
      } else if (mappingsInput?.type === "field") {
        await tx.connectorFieldMapping.deleteMany({
          where: { connectorId, workspaceId },
        });

        await Promise.all(
          mappingsInput.mappings.map((mapping) =>
            tx.connectorFieldMapping.create({
              data: {
                connectorId,
                workspaceId,
                sourceFieldId: mapping.sourceFieldId,
                targetFieldId: mapping.targetFieldId,
                staticValue: mapping.staticValue,
              },
            })
          )
        );
      }

      return tx.connector.findUniqueOrThrow({
        where: { id: connectorId },
        select: selectConnectorWithMappings,
      });
    });

    return mapConnectorWithMappings(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw mapUniqueConstraintError(error);
      }
      if (error.code === PrismaErrorType.RecordDoesNotExist) {
        throw new ResourceNotFoundError("Connector", connectorId);
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
