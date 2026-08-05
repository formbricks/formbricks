import { Prisma, WebhookSource } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";

export const mockedPrismaWebhookUpdateReturn = {
  id: "123",
  url: "",
  name: null,
  createdAt: new Date("2025-03-24T07:27:36.850Z"),
  updatedAt: new Date("2025-03-24T07:27:36.850Z"),
  source: "user" as WebhookSource,
  workspaceId: "workspace-123",
  triggers: [],
  surveyIds: [],
  secret: null,
};

export const prismaNotFoundError = new Prisma.PrismaClientKnownRequestError("Record does not exist", {
  code: PrismaErrorType.RelatedRecordNotFound,
  clientVersion: "PrismaClient 4.0.0",
});
