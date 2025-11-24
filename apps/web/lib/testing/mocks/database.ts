import { vi } from "vitest";

/**
 * Mock methods for contact operations.
 * Used to mock prisma.contact in database operations.
 */
export const mockContactMethods = () => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  delete: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
});

/**
 * Mock methods for contact attribute operations.
 * Used to mock prisma.contactAttribute in database operations.
 */
export const mockContactAttributeMethods = () => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
});

/**
 * Mock methods for contact attribute key operations.
 * Used to mock prisma.contactAttributeKey in database operations.
 */
export const mockContactAttributeKeyMethods = () => ({
  findMany: vi.fn(),
  createMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findUnique: vi.fn(),
});

/**
 * Mock methods for response quota link operations.
 * Used to mock prisma.responseQuotaLink in database operations.
 */
export const mockResponseQuotaLinkMethods = () => ({
  deleteMany: vi.fn(),
  createMany: vi.fn(),
  updateMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
});

/**
 * Complete mock setup for contacts module.
 * Reduces 20-30 lines of mock setup per test file to 1 line.
 *
 * @example
 * ```typescript
 * import { createContactsMocks } from "@/lib/testing/mocks";
 * import { vi } from "vitest";
 *
 * vi.mock("@formbricks/database", () => createContactsMocks());
 * ```
 */
export function createContactsMocks() {
  return {
    prisma: {
      contact: mockContactMethods(),
      contactAttribute: mockContactAttributeMethods(),
      contactAttributeKey: mockContactAttributeKeyMethods(),
    },
  };
}

/**
 * Complete mock setup for quotas module.
 * Reduces 30-40 lines of mock setup per test file to 1 line.
 *
 * @example
 * ```typescript
 * import { createQuotasMocks } from "@/lib/testing/mocks";
 * import { vi } from "vitest";
 *
 * vi.mock("@formbricks/database", () => createQuotasMocks());
 * ```
 */
export function createQuotasMocks() {
  return {
    prisma: {
      $transaction: vi.fn(),
      responseQuotaLink: mockResponseQuotaLinkMethods(),
    },
  };
}

/**
 * Mock methods for survey operations.
 */
export const mockSurveyMethods = () => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
});

/**
 * Mock methods for response operations.
 */
export const mockResponseMethods = () => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
});

/**
 * Complete mock setup for surveys module.
 */
export function createSurveysMocks() {
  return {
    prisma: {
      survey: mockSurveyMethods(),
      response: mockResponseMethods(),
    },
  };
}
