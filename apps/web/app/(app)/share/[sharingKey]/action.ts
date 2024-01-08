"use server";

import { getSurveyByResultShareKey } from "@formbricks/lib/survey/service";

export async function getResultShareUrlSurveyAction(key: string): Promise<string | null> {
  return getSurveyByResultShareKey(key);
}
