"use server";
import { generateSurveySingleUseId } from "@/lib/singleUseSurveys";

export async function generateSingleUseIdAction(isEncrypted: boolean): Promise<string> {
  return generateSurveySingleUseId(isEncrypted);
}
