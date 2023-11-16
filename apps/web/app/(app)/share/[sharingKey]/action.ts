"use server";

import { getResponseKeySurvey } from "@formbricks/lib/resultShareUrl/service";

export async function getResultShareUrlSurveyAction(key: string): Promise<string | null> {
  return getResponseKeySurvey(key);
}
