"use server";

import { getAirtableTables } from "@formbricks/lib/airtable/service";

export const refreshTablesAction = async (environmentId: string) => {
  return await getAirtableTables(environmentId);
};
