"use server";

import { deleteResponse } from "@formbricks/lib/services/response";

export async function deleteResponseAction(responseId: string) {
  return await deleteResponse(responseId);
}
