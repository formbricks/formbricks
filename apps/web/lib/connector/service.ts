import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import {
  TConnector,
  TConnectorCreateInput,
  TConnectorFieldMapping,
  TConnectorFieldMappingCreateInput,
  TConnectorFormbricksMapping,
  TConnectorFormbricksMappingCreateInput,
  TConnectorUpdateInput,
  TConnectorWithMappings,
  TFormbricksConnector,
  ZConnectorCreateInput,
  ZConnectorFieldMappingCreateInput,
  ZConnectorFormbricksMappingCreateInput,
  ZConnectorUpdateInput,
} from "@formbricks/types/connector";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";

// Select object for Connector with Formbricks mappings
const selectConnectorWithFormbricksMappings = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  status: true,
  environmentId: true,
  config: true,
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
      survey: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
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

// Select object for Connector without mappings
const selectConnector = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  status: true,
  environmentId: true,
  config: true,
  lastSyncAt: true,
  errorMessage: true,
} satisfies Prisma.ConnectorSelect;

/**
 * Get all connectors for an environment
 */
export const getConnectors = reactCache(
  async (environmentId: string, page?: number): Promise<TConnector[]> => {
    validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

    try {
      const connectors = await prisma.connector.findMany({
        where: {
          environmentId,
        },
        select: selectConnector,
        orderBy: {
          createdAt: "desc",
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });

      return connectors as TConnector[];
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * Get all connectors for an environment with their mappings
 */
export const getConnectorsWithMappings = reactCache(
  async (environmentId: string, page?: number): Promise<TConnectorWithMappings[]> => {
    validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

    try {
      const connectors = await prisma.connector.findMany({
        where: {
          environmentId,
        },
        select: selectConnectorWithFormbricksMappings,
        orderBy: {
          createdAt: "desc",
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });

      return connectors as unknown as TConnectorWithMappings[];
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * Get a single connector by ID
 */
export const getConnector = reactCache(async (connectorId: string): Promise<TConnector | null> => {
  validateInputs([connectorId, ZId]);

  try {
    const connector = await prisma.connector.findUnique({
      where: {
        id: connectorId,
      },
      select: selectConnector,
    });

    return connector as TConnector | null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * Get a single connector by ID with its mappings
 */
export const getConnectorWithMappings = reactCache(
  async (connectorId: string): Promise<TConnectorWithMappings | null> => {
    validateInputs([connectorId, ZId]);

    try {
      const connector = await prisma.connector.findUnique({
        where: {
          id: connectorId,
        },
        select: selectConnectorWithFormbricksMappings,
      });

      return connector as unknown as TConnectorWithMappings | null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * Get all Formbricks connectors that have mappings for a specific survey
 */
export const getConnectorsBySurveyId = reactCache(
  async (surveyId: string): Promise<TFormbricksConnector[]> => {
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
        select: selectConnectorWithFormbricksMappings,
      });

      return connectors as unknown as TFormbricksConnector[];
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export enum ConnectorError {
  CONNECTOR_NOT_FOUND = "CONNECTOR_NOT_FOUND",
  DUPLICATE_MAPPING = "DUPLICATE_MAPPING",
  UNEXPECTED_ERROR = "UNEXPECTED_ERROR",
}

/**
 * Create a new connector
 */
export const createConnector = async (
  environmentId: string,
  data: TConnectorCreateInput
): Promise<Result<TConnector, { code: ConnectorError; message: string }>> => {
  validateInputs([environmentId, ZId], [data, ZConnectorCreateInput]);

  try {
    const connector = await prisma.connector.create({
      data: {
        name: data.name,
        type: data.type,
        environmentId,
        config: data.config ?? Prisma.JsonNull,
      },
      select: selectConnector,
    });

    return ok(connector as TConnector);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return err({
        code: ConnectorError.UNEXPECTED_ERROR,
        message: error.message,
      });
    }
    return err({
      code: ConnectorError.UNEXPECTED_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Update a connector
 */
export const updateConnector = async (
  connectorId: string,
  data: TConnectorUpdateInput
): Promise<Result<TConnector, { code: ConnectorError; message: string }>> => {
  validateInputs([connectorId, ZId], [data, ZConnectorUpdateInput]);

  try {
    const connector = await prisma.connector.update({
      where: {
        id: connectorId,
      },
      data: {
        name: data.name,
        status: data.status,
        config: data.config ?? undefined,
        errorMessage: data.errorMessage,
        lastSyncAt: data.lastSyncAt,
      },
      select: selectConnector,
    });

    return ok(connector as TConnector);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordNotFound) {
        return err({
          code: ConnectorError.CONNECTOR_NOT_FOUND,
          message: "Connector not found",
        });
      }
      return err({
        code: ConnectorError.UNEXPECTED_ERROR,
        message: error.message,
      });
    }
    return err({
      code: ConnectorError.UNEXPECTED_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Delete a connector
 */
export const deleteConnector = async (
  connectorId: string
): Promise<Result<TConnector, { code: ConnectorError; message: string }>> => {
  validateInputs([connectorId, ZId]);

  try {
    const connector = await prisma.connector.delete({
      where: {
        id: connectorId,
      },
      select: selectConnector,
    });

    return ok(connector as TConnector);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordNotFound) {
        return err({
          code: ConnectorError.CONNECTOR_NOT_FOUND,
          message: "Connector not found",
        });
      }
      return err({
        code: ConnectorError.UNEXPECTED_ERROR,
        message: error.message,
      });
    }
    return err({
      code: ConnectorError.UNEXPECTED_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Create Formbricks element mappings for a connector
 */
export const createFormbricksMappings = async (
  connectorId: string,
  mappings: TConnectorFormbricksMappingCreateInput[]
): Promise<Result<TConnectorFormbricksMapping[], { code: ConnectorError; message: string }>> => {
  validateInputs([connectorId, ZId]);
  mappings.forEach((mapping) => validateInputs([mapping, ZConnectorFormbricksMappingCreateInput]));

  try {
    const createdMappings = await prisma.$transaction(
      mappings.map((mapping) =>
        prisma.connectorFormbricksMapping.create({
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

    return ok(createdMappings as TConnectorFormbricksMapping[]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        return err({
          code: ConnectorError.DUPLICATE_MAPPING,
          message: "A mapping for this survey element already exists",
        });
      }
      return err({
        code: ConnectorError.UNEXPECTED_ERROR,
        message: error.message,
      });
    }
    return err({
      code: ConnectorError.UNEXPECTED_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Sync Formbricks mappings - replaces all existing mappings with new ones
 */
export const syncFormbricksMappings = async (
  connectorId: string,
  mappings: TConnectorFormbricksMappingCreateInput[]
): Promise<Result<TConnectorFormbricksMapping[], { code: ConnectorError; message: string }>> => {
  validateInputs([connectorId, ZId]);
  mappings.forEach((mapping) => validateInputs([mapping, ZConnectorFormbricksMappingCreateInput]));

  try {
    // Delete all existing mappings and create new ones in a transaction
    const createdMappings = await prisma.$transaction(async (tx) => {
      // Delete existing mappings
      await tx.connectorFormbricksMapping.deleteMany({
        where: {
          connectorId,
        },
      });

      // Create new mappings
      const newMappings = await Promise.all(
        mappings.map((mapping) =>
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

      return newMappings;
    });

    return ok(createdMappings as TConnectorFormbricksMapping[]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return err({
        code: ConnectorError.UNEXPECTED_ERROR,
        message: error.message,
      });
    }
    return err({
      code: ConnectorError.UNEXPECTED_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Delete a Formbricks mapping
 */
export const deleteFormbricksMapping = async (
  mappingId: string
): Promise<Result<TConnectorFormbricksMapping, { code: ConnectorError; message: string }>> => {
  validateInputs([mappingId, ZId]);

  try {
    const mapping = await prisma.connectorFormbricksMapping.delete({
      where: {
        id: mappingId,
      },
    });

    return ok(mapping as TConnectorFormbricksMapping);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordNotFound) {
        return err({
          code: ConnectorError.CONNECTOR_NOT_FOUND,
          message: "Mapping not found",
        });
      }
      return err({
        code: ConnectorError.UNEXPECTED_ERROR,
        message: error.message,
      });
    }
    return err({
      code: ConnectorError.UNEXPECTED_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Create field mappings for a connector (webhook, csv, email, slack)
 */
export const createFieldMappings = async (
  connectorId: string,
  mappings: TConnectorFieldMappingCreateInput[]
): Promise<Result<TConnectorFieldMapping[], { code: ConnectorError; message: string }>> => {
  validateInputs([connectorId, ZId]);
  mappings.forEach((mapping) => validateInputs([mapping, ZConnectorFieldMappingCreateInput]));

  try {
    const createdMappings = await prisma.$transaction(
      mappings.map((mapping) =>
        prisma.connectorFieldMapping.create({
          data: {
            connectorId,
            sourceFieldId: mapping.sourceFieldId,
            targetFieldId: mapping.targetFieldId,
            staticValue: mapping.staticValue,
          },
        })
      )
    );

    return ok(createdMappings as TConnectorFieldMapping[]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        return err({
          code: ConnectorError.DUPLICATE_MAPPING,
          message: "A mapping for this field already exists",
        });
      }
      return err({
        code: ConnectorError.UNEXPECTED_ERROR,
        message: error.message,
      });
    }
    return err({
      code: ConnectorError.UNEXPECTED_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Sync field mappings - replaces all existing field mappings with new ones
 */
export const syncFieldMappings = async (
  connectorId: string,
  mappings: TConnectorFieldMappingCreateInput[]
): Promise<Result<TConnectorFieldMapping[], { code: ConnectorError; message: string }>> => {
  validateInputs([connectorId, ZId]);
  mappings.forEach((mapping) => validateInputs([mapping, ZConnectorFieldMappingCreateInput]));

  try {
    // Delete all existing mappings and create new ones in a transaction
    const createdMappings = await prisma.$transaction(async (tx) => {
      // Delete existing mappings
      await tx.connectorFieldMapping.deleteMany({
        where: {
          connectorId,
        },
      });

      // Create new mappings
      const newMappings = await Promise.all(
        mappings.map((mapping) =>
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

      return newMappings;
    });

    return ok(createdMappings as TConnectorFieldMapping[]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return err({
        code: ConnectorError.UNEXPECTED_ERROR,
        message: error.message,
      });
    }
    return err({
      code: ConnectorError.UNEXPECTED_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Delete a field mapping
 */
export const deleteFieldMapping = async (
  mappingId: string
): Promise<Result<TConnectorFieldMapping, { code: ConnectorError; message: string }>> => {
  validateInputs([mappingId, ZId]);

  try {
    const mapping = await prisma.connectorFieldMapping.delete({
      where: {
        id: mappingId,
      },
    });

    return ok(mapping as TConnectorFieldMapping);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordNotFound) {
        return err({
          code: ConnectorError.CONNECTOR_NOT_FOUND,
          message: "Mapping not found",
        });
      }
      return err({
        code: ConnectorError.UNEXPECTED_ERROR,
        message: error.message,
      });
    }
    return err({
      code: ConnectorError.UNEXPECTED_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get Formbricks mappings for a connector
 */
export const getFormbricksMappings = reactCache(
  async (connectorId: string): Promise<TConnectorFormbricksMapping[]> => {
    validateInputs([connectorId, ZId]);

    try {
      const mappings = await prisma.connectorFormbricksMapping.findMany({
        where: {
          connectorId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return mappings as TConnectorFormbricksMapping[];
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * Get field mappings for a connector
 */
export const getFieldMappings = reactCache(async (connectorId: string): Promise<TConnectorFieldMapping[]> => {
  validateInputs([connectorId, ZId]);

  try {
    const mappings = await prisma.connectorFieldMapping.findMany({
      where: {
        connectorId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return mappings as TConnectorFieldMapping[];
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});
