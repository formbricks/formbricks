/**
 * Centralized mock exports for all testing utilities.
 *
 * Import only what you need:
 *
 * @example
 * ```typescript
 * import { createContactsMocks } from "@/lib/testing/mocks";
 * import { COMMON_ERRORS, createPrismaError } from "@/lib/testing/mocks";
 * import { createMockTransaction, mockPrismaTransaction } from "@/lib/testing/mocks";
 * ```
 *
 * Or import everything:
 *
 * @example
 * ```typescript
 * import * as mocks from "@/lib/testing/mocks";
 * ```
 */

export {
  createContactsMocks,
  createQuotasMocks,
  createSurveysMocks,
  mockContactMethods,
  mockContactAttributeMethods,
  mockContactAttributeKeyMethods,
  mockResponseQuotaLinkMethods,
  mockSurveyMethods,
  mockResponseMethods,
} from "./database";

export {
  createPrismaError,
  COMMON_ERRORS,
  MockValidationError,
  MockDatabaseError,
  MockNotFoundError,
  MockAuthorizationError,
} from "./errors";

export {
  createMockTransaction,
  mockPrismaTransaction,
  quotaTransactionMock,
  contactTransactionMock,
  responseTransactionMock,
  sequenceTransactionMocks,
} from "./transactions";
