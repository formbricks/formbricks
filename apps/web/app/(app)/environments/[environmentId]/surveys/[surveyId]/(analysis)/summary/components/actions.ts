"use server";
import { generateSurveySingleUseId } from "@/app/lib/singleUseSurveys";

export async function generateSingleUseIdAction(isEncrypted: boolean): Promise<string> {
  const singleUseId = generateSurveySingleUseId(isEncrypted);
  return singleUseId;
}
