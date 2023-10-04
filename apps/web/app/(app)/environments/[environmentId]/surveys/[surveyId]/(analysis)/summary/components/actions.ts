"use server";
import { generateSurveySingleUseId } from "@/lib/singleUseSurveys";

export async function generateSingleUseIdAction(isEncrypted) {
  const ids = generateSurveySingleUseId(isEncrypted);
  console.log(ids);
  return ids;
}
