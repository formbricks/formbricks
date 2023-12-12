import "server-only";

import { TResponse, TResponseTtc } from "@formbricks/types/responses";

export const formatResponseDateFields = (response: TResponse): TResponse => {
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

export function calculateTtcTotal(ttc: TResponseTtc) {
  const result = { ...ttc };
  result._total = Object.values(result).reduce((acc: number, val: number) => acc + val, 0);

  return result;
}
