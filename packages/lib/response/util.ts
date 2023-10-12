import "server-only";

import { TResponseDates } from "@formbricks/types/v1/responses";

export const formatResponseDateFields = (response: TResponseDates): TResponseDates => {
  if (typeof response.createdAt === "string") {
    response.createdAt = new Date(response.createdAt);
  }
  if (typeof response.updatedAt === "string") {
    response.updatedAt = new Date(response.updatedAt);
  }

  return response;
};
