import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getContactAttributes, hasEmailAttribute } from "./contact-attributes";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttribute: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/cache", () => ({ cache: (fn) => fn }));
vi.mock("@/lib/cache/contact-attribute", () => ({
  contactAttributeCache: {
    tag: { byContactId: (id) => `contact-${id}`, byEnvironmentId: (env) => `env-${env}` },
  },
}));
vi.mock("@/lib/cache/contact-attribute-key", () => ({
  contactAttributeKeyCache: { tag: { byEnvironmentIdAndKey: (env, key) => `env-${env}-key-${key}` } },
}));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));
vi.mock("react", () => ({ cache: (fn) => fn }));

const contactId = "contact-1";
const environmentId = "env-1";
const email = "john@example.com";

const mockAttributes = [
  { value: "john@example.com", attributeKey: { key: "email", name: "Email" } },
  { value: "John", attributeKey: { key: "name", name: "Name" } },
];

describe("getContactAttributes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns attributes as object", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue(mockAttributes);
    const result = await getContactAttributes(contactId);
    expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
      where: { contactId },
      select: { value: true, attributeKey: { select: { key: true, name: true } } },
    });
    expect(result).toEqual({ email: "john@example.com", name: "John" });
  });

  test("returns empty object if no attributes", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
    const result = await getContactAttributes(contactId);
    expect(result).toEqual({});
  });
});

describe("hasEmailAttribute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns true if email attribute exists", async () => {
    vi.mocked(prisma.contactAttribute.findFirst).mockResolvedValue({ id: "attr-1" });
    const result = await hasEmailAttribute(email, environmentId, contactId);
    expect(prisma.contactAttribute.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [{ attributeKey: { key: "email", environmentId }, value: email }, { NOT: { contactId } }],
      },
      select: { id: true },
    });
    expect(result).toBe(true);
  });

  test("returns false if email attribute does not exist", async () => {
    vi.mocked(prisma.contactAttribute.findFirst).mockResolvedValue(null);
    const result = await hasEmailAttribute(email, environmentId, contactId);
    expect(result).toBe(false);
  });
});
