import "server-only";
import { Prisma } from "@prisma/client";
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
  environmentId: true,
  lastSyncAt: true,
  errorMessage: true,
  formbricksMappings: {
    select: {
      id: true,
      createdAt: true,
      connectorId: true,
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
  environmentId: true,
  lastSyncAt: true,
  errorMessage: true,
} satisfies Prisma.ConnectorSelect;

export const getConnectorsWithMappings = reactCache(
  async (environmentId: string, page?: number): Promise<TConnectorWithMappings[]> => {
    validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

    try {
      const connectors = await prisma.connector.findMany({
        where: {
          environmentId,
        },
        select: selectConnectorWithMappings,
        orderBy: {
          createdAt: "desc",
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });

      return connectors as TConnectorWithMappings[];
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
          type: "formbricks",
          status: "active",
          formbricksMappings: {
            some: {
              surveyId,
            },
          },
        },
        select: selectConnectorWithMappings,
      });

      return connectors as TConnectorWithMappings[];
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
  data: TConnectorUpdateInput
): Promise<TConnector> => {
  validateInputs([connectorId, ZId], [data, ZConnectorUpdateInput]);

  try {
    const connector = await prisma.connector.update({
      where: {
        id: connectorId,
      },
      data: {
        name: data.name,
        status: data.status,
        errorMessage: data.errorMessage,
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

export const deleteConnector = async (connectorId: string): Promise<TConnector> => {
  validateInputs([connectorId, ZId]);

  try {
    const connector = await prisma.connector.delete({
      where: {
        id: connectorId,
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

export type TFormbricksMappingsInput = {
  type: "formbricks";
  mappings: TConnectorFormbricksMappingCreateInput[];
};

export type TFieldMappingsInput = {
  type: "field";
  mappings: TConnectorFieldMappingCreateInput[];
};

export type TMappingsInput = TFormbricksMappingsInput | TFieldMappingsInput;

export const createConnectorWithMappings = async (
  environmentId: string,
  data: TConnectorCreateInput,
  mappingsInput?: TMappingsInput
): Promise<TConnectorWithMappings> => {
  validateInputs([environmentId, ZId], [data, ZConnectorCreateInput]);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const connector = await tx.connector.create({
        data: {
          name: data.name,
          type: data.type,
          environmentId,
        },
      });

      if (mappingsInput?.type === "formbricks") {
        await Promise.all(
          mappingsInput.mappings.map((mapping) =>
            tx.connectorFormbricksMapping.create({
              data: {
                connectorId: connector.id,
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

    return result as TConnectorWithMappings;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError(`Connector with name ${data.name} already exists`);
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateConnectorWithMappings = async (
  connectorId: string,
  data: TConnectorUpdateInput,
  mappingsInput?: TMappingsInput
): Promise<TConnectorWithMappings> => {
  validateInputs([connectorId, ZId], [data, ZConnectorUpdateInput]);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.connector.update({
        where: { id: connectorId },
        data: {
          name: data.name,
          status: data.status,
          errorMessage: data.errorMessage,
          lastSyncAt: data.lastSyncAt,
        },
      });

      if (mappingsInput?.type === "formbricks") {
        await tx.connectorFormbricksMapping.deleteMany({
          where: { connectorId },
        });

        await Promise.all(
          mappingsInput.mappings.map((mapping) =>
            tx.connectorFormbricksMapping.create({
              data: {
                connectorId,
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
          where: { connectorId },
        });

        await Promise.all(
          mappingsInput.mappings.map((mapping) =>
            tx.connectorFieldMapping.create({
              data: {
                connectorId,
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

    return result as TConnectorWithMappings;
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
