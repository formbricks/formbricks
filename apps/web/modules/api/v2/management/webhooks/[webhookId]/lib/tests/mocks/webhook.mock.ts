import { WebhookSource } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { PrismaErrorType } from "@formbricks/database/src/types/error";

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

export const prismaNotFoundError = new PrismaClientKnownRequestError("Record does not exist", {
  code: PrismaErrorType.RecordDoesNotExist,
  clientVersion: "PrismaClient 4.0.0",
});
