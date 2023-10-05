"use server";
import { generateSurveySingleUseId } from "@/lib/singleUseSurveys";

export async function generateSingleUseIdAction(isEncrypted: boolean): Promise<string> {
  const singleUseId = generateSurveySingleUseId(isEncrypted);
  return singleUseId;
}
