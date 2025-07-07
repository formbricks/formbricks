import { Prisma, WebhookSource } from "@prisma/client";
import { PrismaErrorType } from "@formbricks/database/types/error";

export const mockedPrismaWebhookUpdateReturn = {
  id: "123",
  url: "",
  name: null,
  createdAt: new Date("2025-03-24T07:27:36.850Z"),
  updatedAt: new Date("2025-03-24T07:27:36.850Z"),
  source: "user" as WebhookSource,
  environmentId: "",
  triggers: [],
  surveyIds: [],
};

export const prismaNotFoundError = new Prisma.PrismaClientKnownRequestError("Record does not exist", {
  code: PrismaErrorType.RecordDoesNotExist,
  clientVersion: "PrismaClient 4.0.0",
});
