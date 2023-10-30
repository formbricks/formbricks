import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";
import { prisma } from "./client";

jest.mock("./client", () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock("next/cache", () => ({
  __esModule: true,
  unstable_cache: (fn: () => {}) => {
    return async () => {
      return fn();
    };
  },
  revalidateTag: jest.fn(),
}));

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});
