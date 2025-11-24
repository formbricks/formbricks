import { vi } from "vitest";

/**
 * Factory to dynamically create mock transaction objects with specified methods.
 * Eliminates complex, repetitive transaction mock setup across test files.
 *
 * @param structure - Object mapping namespaces to arrays of method names
 * @returns Mock transaction object with all specified methods as vi.fn()
 *
 * @example
 * ```typescript
 * import { createMockTransaction } from "@/lib/testing/mocks";
 *
 * const mockTx = createMockTransaction({
 *   responseQuotaLink: ["deleteMany", "createMany", "updateMany", "count", "groupBy"],
 *   contact: ["findMany", "create"],
 * });
 *
 * // Now you have:
 * // mockTx.responseQuotaLink.deleteMany, mockTx.responseQuotaLink.createMany, etc.
 * // mockTx.contact.findMany, mockTx.contact.create, etc.
 * ```
 */
export function createMockTransaction(structure: Record<string, string[]>) {
  return Object.entries(structure).reduce(
    (acc, [namespace, methods]) => {
      acc[namespace] = methods.reduce(
        (methodAcc, method) => {
          methodAcc[method] = vi.fn();
          return methodAcc;
        },
        {} as Record<string, ReturnType<typeof vi.fn>>
      );
      return acc;
    },
    {} as Record<string, Record<string, ReturnType<typeof vi.fn>>>
  );
}

/**
 * Create a mock Prisma $transaction wrapper.
 * Passes the transaction object to the callback function.
 *
 * @param mockTx - The mock transaction object
 * @returns A vi.fn() that mocks prisma.$transaction
 *
 * @example
 * ```typescript
 * import { createMockTransaction, mockPrismaTransaction } from "@/lib/testing/mocks";
 *
 * const mockTx = createMockTransaction({
 *   responseQuotaLink: ["deleteMany", "createMany"],
 * });
 *
 * vi.mocked(prisma.$transaction) = mockPrismaTransaction(mockTx);
 *
 * // Now when code calls prisma.$transaction(async (tx) => { ... })
 * // the tx parameter will be mockTx
 * ```
 */
export function mockPrismaTransaction(mockTx: any) {
  return vi.fn(async (cb: any) => cb(mockTx));
}

/**
 * Pre-configured transaction mock for quota operations.
 * Use this when testing quota-related database transactions.
 *
 * @example
 * ```typescript
 * import { quotaTransactionMock } from "@/lib/testing/mocks";
 *
 * vi.mocked(prisma.$transaction) = quotaTransactionMock;
 * ```
 */
export const quotaTransactionMock = createMockTransaction({
  responseQuotaLink: ["deleteMany", "createMany", "updateMany", "count", "groupBy"],
});

/**
 * Pre-configured transaction mock for contact operations.
 */
export const contactTransactionMock = createMockTransaction({
  contact: ["findMany", "create", "update", "delete"],
  contactAttribute: ["findMany", "create", "update", "deleteMany"],
  contactAttributeKey: ["findMany", "create"],
});

/**
 * Pre-configured transaction mock for response operations.
 */
export const responseTransactionMock = createMockTransaction({
  response: ["findMany", "create", "update", "delete", "count"],
  responseQuotaLink: ["create", "deleteMany", "updateMany"],
});

/**
 * Utility to configure multiple transaction return values in sequence.
 * Useful when code makes multiple calls to $transaction with different structures.
 *
 * @param txMocks - Array of transaction mock objects
 * @returns A vi.fn() that returns each mock in sequence
 *
 * @example
 * ```typescript
 * import { createMockTransaction, sequenceTransactionMocks } from "@/lib/testing/mocks";
 *
 * const tx1 = createMockTransaction({ contact: ["findMany"] });
 * const tx2 = createMockTransaction({ response: ["count"] });
 *
 * vi.mocked(prisma.$transaction) = sequenceTransactionMocks([tx1, tx2]);
 *
 * // First call gets tx1, second call gets tx2
 * ```
 */
export function sequenceTransactionMocks(txMocks: any[]) {
  let callCount = 0;
  return vi.fn(async (cb: any) => {
    const currentMock = txMocks[callCount];
    callCount++;
    return cb(currentMock);
  });
}
