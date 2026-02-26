import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  createConnectorWithMappings,
  deleteConnector,
  getConnectorsBySurveyId,
  getConnectorsWithMappings,
  updateConnector,
  updateConnectorWithMappings,
} from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    connector: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    connectorFormbricksMapping: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    connectorFieldMapping: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

const ENV_ID = "clxxxxxxxxxxxxxxxx001";
const CONNECTOR_ID = "clxxxxxxxxxxxxxxxx002";
const SURVEY_ID = "clxxxxxxxxxxxxxxxx003";
const NOW = new Date("2026-02-24T10:00:00.000Z");

const mockConnector = {
  id: CONNECTOR_ID,
  createdAt: NOW,
  updatedAt: NOW,
  name: "Test Connector",
  type: "formbricks" as const,
  status: "active" as const,
  environmentId: ENV_ID,
  lastSyncAt: null,
  createdBy: null,
};

const mockConnectorWithMappingsFromDb = {
  ...mockConnector,
  creator: null,
  formbricksMappings: [
    {
      id: "mapping-1",
      createdAt: NOW,
      connectorId: CONNECTOR_ID,
      environmentId: ENV_ID,
      surveyId: SURVEY_ID,
      elementId: "el-1",
      hubFieldType: "text",
      customFieldLabel: null,
    },
  ],
  fieldMappings: [],
};

const mockConnectorWithMappings = {
  ...mockConnector,
  creatorName: null,
  formbricksMappings: mockConnectorWithMappingsFromDb.formbricksMappings,
  fieldMappings: [],
};

describe("getConnectorsWithMappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns connectors for the given environment", async () => {
    vi.mocked(prisma.connector.findMany).mockResolvedValue([mockConnectorWithMappingsFromDb] as never);

    const result = await getConnectorsWithMappings(ENV_ID);

    expect(prisma.connector.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { environmentId: ENV_ID },
        orderBy: { createdAt: "desc" },
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(CONNECTOR_ID);
  });

  test("applies pagination when page is provided", async () => {
    vi.mocked(prisma.connector.findMany).mockResolvedValue([] as never);

    await getConnectorsWithMappings(ENV_ID, 2);

    expect(prisma.connector.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: expect.any(Number),
        skip: expect.any(Number),
      })
    );
  });

  test("returns empty array when no connectors exist", async () => {
    vi.mocked(prisma.connector.findMany).mockResolvedValue([] as never);

    const result = await getConnectorsWithMappings(ENV_ID);
    expect(result).toEqual([]);
  });

  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.connector.findMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("connection error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(getConnectorsWithMappings(ENV_ID)).rejects.toThrow(DatabaseError);
  });
});

describe("getConnectorsBySurveyId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns active formbricks connectors linked to the survey", async () => {
    vi.mocked(prisma.connector.findMany).mockResolvedValue([mockConnectorWithMappingsFromDb] as never);

    const result = await getConnectorsBySurveyId(SURVEY_ID);

    expect(prisma.connector.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: "formbricks",
          status: "active",
          formbricksMappings: { some: { surveyId: SURVEY_ID } },
        },
      })
    );
    expect(result).toHaveLength(1);
  });

  test("returns empty when no connectors match", async () => {
    vi.mocked(prisma.connector.findMany).mockResolvedValue([] as never);

    const result = await getConnectorsBySurveyId(SURVEY_ID);
    expect(result).toEqual([]);
  });

  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.connector.findMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(getConnectorsBySurveyId(SURVEY_ID)).rejects.toThrow(DatabaseError);
  });
});

describe("updateConnector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("updates connector name and returns the result", async () => {
    const updated = { ...mockConnector, name: "Renamed" };
    vi.mocked(prisma.connector.update).mockResolvedValue(updated as never);

    const result = await updateConnector(CONNECTOR_ID, ENV_ID, { name: "Renamed" });

    expect(prisma.connector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONNECTOR_ID, environmentId: ENV_ID },
        data: expect.objectContaining({ name: "Renamed" }),
      })
    );
    expect(result.name).toBe("Renamed");
  });

  test("updates connector status", async () => {
    const updated = { ...mockConnector, status: "paused" };
    vi.mocked(prisma.connector.update).mockResolvedValue(updated as never);

    const result = await updateConnector(CONNECTOR_ID, ENV_ID, { status: "paused" });
    expect(result.status).toBe("paused");
  });

  test("throws ResourceNotFoundError when connector does not exist", async () => {
    vi.mocked(prisma.connector.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2015",
        clientVersion: "5.0.0",
      })
    );

    await expect(updateConnector(CONNECTOR_ID, ENV_ID, { name: "x" })).rejects.toThrow(ResourceNotFoundError);
  });

  test("throws DatabaseError on generic Prisma error", async () => {
    vi.mocked(prisma.connector.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(updateConnector(CONNECTOR_ID, ENV_ID, { name: "x" })).rejects.toThrow(DatabaseError);
  });

  test("rethrows non-Prisma errors", async () => {
    vi.mocked(prisma.connector.update).mockRejectedValue(new Error("unexpected"));

    await expect(updateConnector(CONNECTOR_ID, ENV_ID, { name: "x" })).rejects.toThrow("unexpected");
  });
});

describe("deleteConnector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("deletes the connector and returns it", async () => {
    vi.mocked(prisma.connector.delete).mockResolvedValue(mockConnector as never);

    const result = await deleteConnector(CONNECTOR_ID, ENV_ID);

    expect(prisma.connector.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONNECTOR_ID, environmentId: ENV_ID },
      })
    );
    expect(result.id).toBe(CONNECTOR_ID);
  });

  test("throws ResourceNotFoundError when connector does not exist", async () => {
    vi.mocked(prisma.connector.delete).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2015",
        clientVersion: "5.0.0",
      })
    );

    await expect(deleteConnector(CONNECTOR_ID, ENV_ID)).rejects.toThrow(ResourceNotFoundError);
  });

  test("throws DatabaseError on generic Prisma error", async () => {
    vi.mocked(prisma.connector.delete).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(deleteConnector(CONNECTOR_ID, ENV_ID)).rejects.toThrow(DatabaseError);
  });
});

describe("createConnectorWithMappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupTransaction = () => {
    const txMethods = {
      connector: {
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      connectorFormbricksMapping: {
        create: vi.fn(),
      },
      connectorFieldMapping: {
        create: vi.fn(),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return (fn as (tx: typeof txMethods) => Promise<unknown>)(txMethods);
    });

    return txMethods;
  };

  test("creates connector without mappings", async () => {
    const tx = setupTransaction();
    tx.connector.create.mockResolvedValue({ id: CONNECTOR_ID, environmentId: ENV_ID });
    tx.connector.findUniqueOrThrow.mockResolvedValue(mockConnectorWithMappingsFromDb);

    const result = await createConnectorWithMappings(ENV_ID, { name: "New", type: "formbricks" });

    expect(tx.connector.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: "New", type: "formbricks", environmentId: ENV_ID },
      })
    );
    expect(tx.connectorFormbricksMapping.create).not.toHaveBeenCalled();
    expect(tx.connectorFieldMapping.create).not.toHaveBeenCalled();
    expect(result).toEqual(mockConnectorWithMappings);
  });

  test("creates connector with formbricks mappings", async () => {
    const tx = setupTransaction();
    tx.connector.create.mockResolvedValue({ id: CONNECTOR_ID, environmentId: ENV_ID });
    tx.connectorFormbricksMapping.create.mockResolvedValue({});
    tx.connector.findUniqueOrThrow.mockResolvedValue(mockConnectorWithMappingsFromDb);

    await createConnectorWithMappings(
      ENV_ID,
      { name: "FB", type: "formbricks" },
      {
        type: "formbricks",
        mappings: [
          { surveyId: SURVEY_ID, elementId: "el-1", hubFieldType: "text" },
          { surveyId: SURVEY_ID, elementId: "el-2", hubFieldType: "nps" },
        ],
      }
    );

    expect(tx.connectorFormbricksMapping.create).toHaveBeenCalledTimes(2);
    expect(tx.connectorFormbricksMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          connectorId: CONNECTOR_ID,
          environmentId: ENV_ID,
          surveyId: SURVEY_ID,
          elementId: "el-1",
          hubFieldType: "text",
        }),
      })
    );
  });

  test("creates connector with field mappings", async () => {
    const tx = setupTransaction();
    tx.connector.create.mockResolvedValue({ id: CONNECTOR_ID, environmentId: ENV_ID });
    tx.connectorFieldMapping.create.mockResolvedValue({});
    tx.connector.findUniqueOrThrow.mockResolvedValue({
      ...mockConnector,
      formbricksMappings: [],
      fieldMappings: [],
    });

    await createConnectorWithMappings(
      ENV_ID,
      { name: "CSV", type: "csv" },
      {
        type: "field",
        mappings: [{ sourceFieldId: "col-1", targetFieldId: "value_text" }],
      }
    );

    expect(tx.connectorFieldMapping.create).toHaveBeenCalledTimes(1);
    expect(tx.connectorFieldMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          connectorId: CONNECTOR_ID,
          environmentId: ENV_ID,
          sourceFieldId: "col-1",
          targetFieldId: "value_text",
        }),
      })
    );
  });

  test("throws InvalidInputError on unique constraint violation", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "5.0.0",
      })
    );

    await expect(createConnectorWithMappings(ENV_ID, { name: "Dup", type: "formbricks" })).rejects.toThrow(
      InvalidInputError
    );
  });

  test("throws DatabaseError on generic Prisma error", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(createConnectorWithMappings(ENV_ID, { name: "Fail", type: "csv" })).rejects.toThrow(
      DatabaseError
    );
  });
});

describe("updateConnectorWithMappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupTransaction = () => {
    const txMethods = {
      connector: {
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      connectorFormbricksMapping: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      connectorFieldMapping: {
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return (fn as (tx: typeof txMethods) => Promise<unknown>)(txMethods);
    });

    return txMethods;
  };

  test("updates connector name without changing mappings", async () => {
    const tx = setupTransaction();
    tx.connector.update.mockResolvedValue(undefined);
    tx.connector.findUniqueOrThrow.mockResolvedValue(mockConnectorWithMappingsFromDb);

    const result = await updateConnectorWithMappings(CONNECTOR_ID, ENV_ID, { name: "Updated" });

    expect(tx.connector.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONNECTOR_ID, environmentId: ENV_ID },
        data: expect.objectContaining({ name: "Updated" }),
      })
    );
    expect(tx.connectorFormbricksMapping.deleteMany).not.toHaveBeenCalled();
    expect(tx.connectorFieldMapping.deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual(mockConnectorWithMappings);
  });

  test("replaces formbricks mappings when provided", async () => {
    const tx = setupTransaction();
    tx.connector.update.mockResolvedValue(undefined);
    tx.connectorFormbricksMapping.deleteMany.mockResolvedValue({ count: 1 });
    tx.connectorFormbricksMapping.create.mockResolvedValue({});
    tx.connector.findUniqueOrThrow.mockResolvedValue(mockConnectorWithMappingsFromDb);

    await updateConnectorWithMappings(
      CONNECTOR_ID,
      ENV_ID,
      { name: "Updated" },
      {
        type: "formbricks",
        mappings: [{ surveyId: SURVEY_ID, elementId: "el-new", hubFieldType: "nps" }],
      }
    );

    expect(tx.connectorFormbricksMapping.deleteMany).toHaveBeenCalledWith({
      where: { connectorId: CONNECTOR_ID, environmentId: ENV_ID },
    });
    expect(tx.connectorFormbricksMapping.create).toHaveBeenCalledTimes(1);
  });

  test("replaces field mappings when provided", async () => {
    const tx = setupTransaction();
    tx.connector.update.mockResolvedValue(undefined);
    tx.connectorFieldMapping.deleteMany.mockResolvedValue({ count: 1 });
    tx.connectorFieldMapping.create.mockResolvedValue({});
    tx.connector.findUniqueOrThrow.mockResolvedValue({
      ...mockConnector,
      formbricksMappings: [],
      fieldMappings: [],
    });

    await updateConnectorWithMappings(
      CONNECTOR_ID,
      ENV_ID,
      { name: "CSV Updated" },
      {
        type: "field",
        mappings: [{ sourceFieldId: "col-x", targetFieldId: "value_number" }],
      }
    );

    expect(tx.connectorFieldMapping.deleteMany).toHaveBeenCalledWith({
      where: { connectorId: CONNECTOR_ID, environmentId: ENV_ID },
    });
    expect(tx.connectorFieldMapping.create).toHaveBeenCalledTimes(1);
  });

  test("throws ResourceNotFoundError when connector does not exist", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2015",
        clientVersion: "5.0.0",
      })
    );

    await expect(updateConnectorWithMappings(CONNECTOR_ID, ENV_ID, { name: "x" })).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  test("throws DatabaseError on generic Prisma error", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "5.0.0",
      })
    );

    await expect(updateConnectorWithMappings(CONNECTOR_ID, ENV_ID, { name: "x" })).rejects.toThrow(
      DatabaseError
    );
  });
});
