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

export function mergeAndAdd(obj1: any, obj2: any, finished = false) {
  const result = { ...obj1 };

  for (let key in obj2) {
    if (result.hasOwnProperty(key)) {
      result[key] += obj2[key];
    } else {
      result[key] = obj2[key];
    }
  }

  if (finished) {
    result._total = Object.values(result).reduce((acc, val) => acc + val, 0);
  }

  return result;
}
