import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";

/**
 * Standard test IDs to eliminate magic strings across test files.
 * Use these constants instead of hardcoded IDs like "contact-1", "env-123", etc.
 *
 * @example
 * ```typescript
 * import { TEST_IDS } from "@/lib/testing/constants";
 *
 * test("should fetch contact", async () => {
 *   const result = await getContact(TEST_IDS.contact);
 *   expect(result).toBeDefined();
 * });
 * ```
 */
export const TEST_IDS = {
  contact: "contact-123",
  contactAlt: "contact-456",
  user: "user-123",
  environment: "env-123",
  survey: "survey-123",
  organization: "org-123",
  quota: "quota-123",
  attribute: "attr-123",
  response: "response-123",
  team: "team-123",
  project: "project-123",
  segment: "segment-123",
  webhook: "webhook-123",
  apiKey: "api-key-123",
  membership: "membership-123",
} as const;

/**
 * Common test fixtures to reduce duplicate test data definitions.
 * Extend these as needed for your specific test cases.
 *
 * @example
 * ```typescript
 * import { FIXTURES } from "@/lib/testing/constants";
 *
 * test("should create contact", async () => {
 *   vi.mocked(getContactAttributeKeys).mockResolvedValue(FIXTURES.attributeKeys);
 *   const result = await createContact(FIXTURES.contact);
 *   expect(result.email).toBe(FIXTURES.contact.email);
 * });
 * ```
 */
export const FIXTURES = {
  contact: {
    id: TEST_IDS.contact,
    email: "test@example.com",
    userId: TEST_IDS.user,
  },

  survey: {
    id: TEST_IDS.survey,
    name: "Test Survey",
    environmentId: TEST_IDS.environment,
  },

  attributeKey: {
    id: TEST_IDS.attribute,
    key: "email",
    name: "Email",
    environmentId: TEST_IDS.environment,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-02"),
    isUnique: false,
    description: null,
    type: "default" as const,
  },

  attributeKeys: [
    {
      id: "key-1",
      key: "email",
      name: "Email",
      environmentId: TEST_IDS.environment,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-02"),
      isUnique: false,
      description: null,
      type: "default",
    },
    {
      id: "key-2",
      key: "name",
      name: "Name",
      environmentId: TEST_IDS.environment,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-02"),
      isUnique: false,
      description: null,
      type: "default",
    },
  ] as TContactAttributeKey[],

  responseData: {
    q1: "Open text answer",
    q2: "Option 1",
  },

  environment: {
    id: TEST_IDS.environment,
    name: "Test Environment",
    type: "development" as const,
  },

  organization: {
    id: TEST_IDS.organization,
    name: "Test Organization",
  },

  project: {
    id: TEST_IDS.project,
    name: "Test Project",
  },
} as const;
