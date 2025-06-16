import { ContactAttributeKey, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TContactAttributeKey, TContactAttributeKeyType } from "@formbricks/types/contact-attribute-key";
import { DatabaseError, OperationNotAllowedError } from "@formbricks/types/errors";
import { TContactAttributeKeyUpdateInput } from "../types/contact-attribute-keys";
import {
  createContactAttributeKey,
  deleteContactAttributeKey,
  getContactAttributeKey,
  updateContactAttributeKey,
} from "./contact-attribute-key";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttributeKey: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT: 10, // Default mock value for tests
  };
});

// Constants used in tests
const mockContactAttributeKeyId = "drw0gc3oa67q113w68wdif0x";
const mockEnvironmentId = "fndlzrzlqw8c6zu9jfwxf34k";
const mockKey = "testKey";
const mockName = "Test Key";

const mockContactAttributeKey: TContactAttributeKey = {
  id: mockContactAttributeKeyId,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: mockName,
  key: mockKey,
  environmentId: mockEnvironmentId,
  type: "custom" as TContactAttributeKeyType,
  description: "A test key",
  isUnique: false,
};

// Define a compatible type for test data, as TContactAttributeKeyUpdateInput might be complex
interface TMockContactAttributeKeyUpdateInput {
  description?: string | null;
}

describe("getContactAttributeKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return contact attribute key if found", async () => {
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue(mockContactAttributeKey);

    const result = await getContactAttributeKey(mockContactAttributeKeyId);

    expect(result).toEqual(mockContactAttributeKey);
    expect(prisma.contactAttributeKey.findUnique).toHaveBeenCalledWith({
      where: { id: mockContactAttributeKeyId },
    });
  });

  test("should return null if contact attribute key not found", async () => {
    vi.mocked(prisma.contactAttributeKey.findUnique).mockResolvedValue(null);

    const result = await getContactAttributeKey(mockContactAttributeKeyId);

    expect(result).toBeNull();
    expect(prisma.contactAttributeKey.findUnique).toHaveBeenCalledWith({
      where: { id: mockContactAttributeKeyId },
    });
  });

  test("should throw DatabaseError if Prisma call fails", async () => {
    const errorMessage = "Prisma findUnique error";
    vi.mocked(prisma.contactAttributeKey.findUnique).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(errorMessage, { code: "P1000", clientVersion: "test" })
    );

    await expect(getContactAttributeKey(mockContactAttributeKeyId)).rejects.toThrow(DatabaseError);
    await expect(getContactAttributeKey(mockContactAttributeKeyId)).rejects.toThrow(errorMessage);
  });

  test("should throw generic error if non-Prisma error occurs", async () => {
    const errorMessage = "Some other error";
    vi.mocked(prisma.contactAttributeKey.findUnique).mockRejectedValue(new Error(errorMessage));

    await expect(getContactAttributeKey(mockContactAttributeKeyId)).rejects.toThrow(Error);
    await expect(getContactAttributeKey(mockContactAttributeKeyId)).rejects.toThrow(errorMessage);
  });
});

describe("createContactAttributeKey", () => {
  const type: TContactAttributeKeyType = "custom";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should create and return a new contact attribute key", async () => {
    const createdAttributeKey = { ...mockContactAttributeKey, id: "new_cak_id", key: mockKey, type };
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(5); // Below limit
    vi.mocked(prisma.contactAttributeKey.create).mockResolvedValue(createdAttributeKey);

    const result = await createContactAttributeKey(mockEnvironmentId, mockKey, type);

    expect(result).toEqual(createdAttributeKey);
    expect(prisma.contactAttributeKey.count).toHaveBeenCalledWith({
      where: { environmentId: mockEnvironmentId },
    });
    expect(prisma.contactAttributeKey.create).toHaveBeenCalledWith({
      data: {
        key: mockKey,
        name: mockKey, // As per implementation
        type,
        environment: { connect: { id: mockEnvironmentId } },
      },
    });
  });

  test("should throw OperationNotAllowedError if max attribute classes reached", async () => {
    // MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT is mocked to 10
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(10);

    await expect(createContactAttributeKey(mockEnvironmentId, mockKey, type)).rejects.toThrow(
      OperationNotAllowedError
    );
    expect(prisma.contactAttributeKey.count).toHaveBeenCalledWith({
      where: { environmentId: mockEnvironmentId },
    });
    expect(prisma.contactAttributeKey.create).not.toHaveBeenCalled();
  });

  test("should throw Prisma error if prisma.contactAttributeKey.count fails", async () => {
    const errorMessage = "Prisma count error";
    const prismaError = new Prisma.PrismaClientKnownRequestError(errorMessage, {
      code: "P1000",
      clientVersion: "test",
    });
    vi.mocked(prisma.contactAttributeKey.count).mockRejectedValue(prismaError);

    await expect(createContactAttributeKey(mockEnvironmentId, mockKey, type)).rejects.toThrow(prismaError);
  });

  test("should throw DatabaseError if Prisma create fails", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(5); // Below limit
    const errorMessage = "Prisma create error";
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(errorMessage, { code: "P2000", clientVersion: "test" })
    );

    await expect(createContactAttributeKey(mockEnvironmentId, mockKey, type)).rejects.toThrow(DatabaseError);
    await expect(createContactAttributeKey(mockEnvironmentId, mockKey, type)).rejects.toThrow(errorMessage);
  });

  test("should throw generic error if non-Prisma error occurs during create", async () => {
    vi.mocked(prisma.contactAttributeKey.count).mockResolvedValue(5);
    const errorMessage = "Some other error during create";
    vi.mocked(prisma.contactAttributeKey.create).mockRejectedValue(new Error(errorMessage));

    await expect(createContactAttributeKey(mockEnvironmentId, mockKey, type)).rejects.toThrow(Error);
    await expect(createContactAttributeKey(mockEnvironmentId, mockKey, type)).rejects.toThrow(errorMessage);
  });
});

describe("deleteContactAttributeKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should delete contact attribute key", async () => {
    const deletedAttributeKey = { ...mockContactAttributeKey };
    vi.mocked(prisma.contactAttributeKey.delete).mockResolvedValue(deletedAttributeKey);

    const result = await deleteContactAttributeKey(mockContactAttributeKeyId);

    expect(result).toEqual(deletedAttributeKey);
    expect(prisma.contactAttributeKey.delete).toHaveBeenCalledWith({
      where: { id: mockContactAttributeKeyId },
    });
  });

  test("should throw DatabaseError if Prisma delete fails", async () => {
    const errorMessage = "Prisma delete error";
    vi.mocked(prisma.contactAttributeKey.delete).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(errorMessage, { code: "P2025", clientVersion: "test" })
    );

    await expect(deleteContactAttributeKey(mockContactAttributeKeyId)).rejects.toThrow(DatabaseError);
    await expect(deleteContactAttributeKey(mockContactAttributeKeyId)).rejects.toThrow(errorMessage);
  });

  test("should throw generic error if non-Prisma error occurs during delete", async () => {
    const errorMessage = "Some other error during delete";
    vi.mocked(prisma.contactAttributeKey.delete).mockRejectedValue(new Error(errorMessage));

    await expect(deleteContactAttributeKey(mockContactAttributeKeyId)).rejects.toThrow(Error);
    await expect(deleteContactAttributeKey(mockContactAttributeKeyId)).rejects.toThrow(errorMessage);
  });
});

describe("updateContactAttributeKey", () => {
  const updateData: TMockContactAttributeKeyUpdateInput = {
    description: "Updated description",
  };
  // Cast to TContactAttributeKeyUpdateInput for the function call, if strict typing is needed beyond the mock.
  const typedUpdateData = updateData as TContactAttributeKeyUpdateInput;

  const updatedAttributeKey = {
    ...mockContactAttributeKey,
    description: updateData.description,
    updatedAt: new Date(), // Update timestamp
  } as ContactAttributeKey;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should update contact attribute key", async () => {
    vi.mocked(prisma.contactAttributeKey.update).mockResolvedValue(updatedAttributeKey);

    const result = await updateContactAttributeKey(mockContactAttributeKeyId, typedUpdateData);

    expect(result).toEqual(updatedAttributeKey);
    expect(prisma.contactAttributeKey.update).toHaveBeenCalledWith({
      where: { id: mockContactAttributeKeyId },
      data: { description: updateData.description },
    });
  });

  test("should throw DatabaseError if Prisma update fails", async () => {
    const errorMessage = "Prisma update error";
    vi.mocked(prisma.contactAttributeKey.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(errorMessage, { code: "P2025", clientVersion: "test" })
    );

    await expect(updateContactAttributeKey(mockContactAttributeKeyId, typedUpdateData)).rejects.toThrow(
      DatabaseError
    );
    await expect(updateContactAttributeKey(mockContactAttributeKeyId, typedUpdateData)).rejects.toThrow(
      errorMessage
    );
  });

  test("should throw generic error if non-Prisma error occurs during update", async () => {
    const errorMessage = "Some other error during update";
    vi.mocked(prisma.contactAttributeKey.update).mockRejectedValue(new Error(errorMessage));

    await expect(updateContactAttributeKey(mockContactAttributeKeyId, typedUpdateData)).rejects.toThrow(
      Error
    );
    await expect(updateContactAttributeKey(mockContactAttributeKeyId, typedUpdateData)).rejects.toThrow(
      errorMessage
    );
  });
});
