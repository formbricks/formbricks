"use server";

import { getAirtableTables } from "@formbricks/lib/airtable/service";

export async function refreshTablesAction(environmentId: string) {
  return await getAirtableTables(environmentId);
}
