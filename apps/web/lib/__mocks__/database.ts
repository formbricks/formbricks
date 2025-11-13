import { beforeEach, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { PrismaClient } from "@formbricks/database/generated/client";

export const prisma = mockDeep<PrismaClient>();

vi.mock("@formbricks/database", () => ({
  __esModule: true,
  prisma,
}));

beforeEach(() => {
  mockReset(prisma);
});
