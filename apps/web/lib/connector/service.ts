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
  ZConnectorCreateInput,
  ZConnectorFieldMappingCreateInput,
  ZConnectorFormbricksMappingCreateInput,
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

// Select object for Connector without mappings
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
        select: selectConnectorWithMappings,
      });

      return connector as TConnectorWithMappings | null;
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

/**
 * Create a new connector
 */
export const createConnector = async (
  environmentId: string,
  data: TConnectorCreateInput
): Promise<TConnector> => {
  validateInputs([environmentId, ZId], [data, ZConnectorCreateInput]);

  try {
    const connector = await prisma.connector.create({
      data: {
        name: data.name,
        type: data.type,
        environmentId,
      },
      select: selectConnector,
    });

    return connector as TConnector;
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

/**
 * Update a connector
 */
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

/**
 * Delete a connector
 */
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

/**
 * Create Formbricks element mappings for a connector
 */
export const createFormbricksMappings = async (
  connectorId: string,
  mappings: TConnectorFormbricksMappingCreateInput[]
): Promise<TConnectorFormbricksMapping[]> => {
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

    return createdMappings as TConnectorFormbricksMapping[];
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("A mapping for this survey element already exists");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/**
 * Sync Formbricks mappings - replaces all existing mappings with new ones
 */
export const syncFormbricksMappings = async (
  connectorId: string,
  mappings: TConnectorFormbricksMappingCreateInput[]
): Promise<TConnectorFormbricksMapping[]> => {
  validateInputs([connectorId, ZId]);
  mappings.forEach((mapping) => validateInputs([mapping, ZConnectorFormbricksMappingCreateInput]));

  try {
    const createdMappings = await prisma.$transaction(async (tx) => {
      await tx.connectorFormbricksMapping.deleteMany({
        where: {
          connectorId,
        },
      });

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

    return createdMappings as TConnectorFormbricksMapping[];
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/**
 * Delete a Formbricks mapping
 */
export const deleteFormbricksMapping = async (mappingId: string): Promise<TConnectorFormbricksMapping> => {
  validateInputs([mappingId, ZId]);

  try {
    const mapping = await prisma.connectorFormbricksMapping.delete({
      where: {
        id: mappingId,
      },
    });

    return mapping as TConnectorFormbricksMapping;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordDoesNotExist) {
        throw new ResourceNotFoundError("FormbricksMapping", mappingId);
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const createFieldMappings = async (
  connectorId: string,
  mappings: TConnectorFieldMappingCreateInput[]
): Promise<TConnectorFieldMapping[]> => {
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

    return createdMappings as TConnectorFieldMapping[];
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("A mapping for this field already exists");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/**
 * Sync field mappings - replaces all existing field mappings with new ones
 */
export const syncFieldMappings = async (
  connectorId: string,
  mappings: TConnectorFieldMappingCreateInput[]
): Promise<TConnectorFieldMapping[]> => {
  validateInputs([connectorId, ZId]);
  mappings.forEach((mapping) => validateInputs([mapping, ZConnectorFieldMappingCreateInput]));

  try {
    const createdMappings = await prisma.$transaction(async (tx) => {
      await tx.connectorFieldMapping.deleteMany({
        where: {
          connectorId,
        },
      });

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

    return createdMappings as TConnectorFieldMapping[];
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

/**
 * Delete a field mapping
 */
export const deleteFieldMapping = async (mappingId: string): Promise<TConnectorFieldMapping> => {
  validateInputs([mappingId, ZId]);

  try {
    const mapping = await prisma.connectorFieldMapping.delete({
      where: {
        id: mappingId,
      },
    });

    return mapping as TConnectorFieldMapping;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordDoesNotExist) {
        throw new ResourceNotFoundError("FieldMapping", mappingId);
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

/**
 * Create a connector with its mappings in a single transaction.
 * Accepts pre-resolved mapping data for both Formbricks and generic connector types.
 */
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

/**
 * Update a connector and replace its mappings in a single transaction.
 * Accepts pre-resolved mapping data for both Formbricks and generic connector types.
 */
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
