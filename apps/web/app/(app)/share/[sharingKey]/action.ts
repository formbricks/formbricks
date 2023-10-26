"use server";

import { getResponseKeySurvey } from "@formbricks/lib/responseSharing/service";

export async function getResponseSharingKeySurveyAction(key: string): Promise<string | null> {
  return getResponseKeySurvey(key);
}
