import "server-only";

import { TResponseDates } from "@formbricks/types/v1/responses";

export const formatResponseDateFields = (response: TResponseDates): TResponseDates => {
  if (typeof response.createdAt === "string") {
    response.createdAt = new Date(response.createdAt);
  }
  if (typeof response.updatedAt === "string") {
    response.updatedAt = new Date(response.updatedAt);
  }

  response.notes = response.notes.map((note) => {
    if (typeof note.createdAt === "string") {
      note.createdAt = new Date(note.createdAt);
    }

    if (typeof note.updatedAt === "string") {
      note.updatedAt = new Date(note.updatedAt);
    }

    return note;
  });

  return response;
};
