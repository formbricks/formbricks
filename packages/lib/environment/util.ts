import "server-only";

import { TEnvironment } from "@formbricks/types/v1/environment";

export const formatEnvironmentDateFields = (environemt: TEnvironment): TEnvironment => {
  if (typeof environemt.createdAt === "string") {
    environemt.createdAt = new Date(environemt.createdAt);
  }
  if (typeof environemt.updatedAt === "string") {
    environemt.updatedAt = new Date(environemt.updatedAt);
  }

  return environemt;
};
