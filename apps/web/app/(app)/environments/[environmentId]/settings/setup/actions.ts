"use server";

import { updateEnvironment } from "@formbricks/lib/services/environment";
import { TEnvironment } from "@formbricks/types/v1/environment";

export async function updateEnvironmentAction(environmentId: string, data: any): Promise<TEnvironment> {
  return await updateEnvironment(environmentId, data);
}
