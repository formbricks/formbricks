import { Prisma } from "@prisma/client";
import { PrismaErrorType } from "@formbricks/database/types/error";

export const mockedDashboard = {
  id: "dashboard123",
  name: "Test Dashboard",
  description: "A test dashboard",
  projectId: "project1",
  createdBy: null,
  createdAt: new Date("2026-01-28T12:00:00.000Z"),
  updatedAt: new Date("2026-01-28T12:00:00.000Z"),
};

export const prismaNotFoundError = new Prisma.PrismaClientKnownRequestError("Record does not exist", {
  code: PrismaErrorType.RecordDoesNotExist,
  clientVersion: "PrismaClient 4.0.0",
});

export const prismaUniqueConstraintError = new Prisma.PrismaClientKnownRequestError(
  "Unique constraint failed",
  {
    code: PrismaErrorType.UniqueConstraintViolation,
    clientVersion: "PrismaClient 4.0.0",
  }
);
