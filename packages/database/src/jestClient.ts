import { mockDeep, DeepMockProxy, mockReset } from "jest-mock-extended";
import { prisma } from "./client";
import { PrismaClient } from "@prisma/client";

jest.mock("./client", () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});
