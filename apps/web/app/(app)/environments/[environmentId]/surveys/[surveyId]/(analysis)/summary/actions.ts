"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { sendEmbedSurveyPreviewEmail } from "@formbricks/lib/emails/emails";
import { AuthenticationError } from "@formbricks/types/v1/errors";
import { generateSurveySingleUseId } from "@/app/lib/singleUseSurveys";

type TSendEmailActionArgs = {
  to: string;
  subject: string;
  html: string;
};

export async function generateSingleUseIdAction(isEncrypted: boolean): Promise<string> {
  const singleUseId = generateSurveySingleUseId(isEncrypted);
  return singleUseId;
}

export const sendEmailAction = async ({ html, subject, to }: TSendEmailActionArgs) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }
  return await sendEmbedSurveyPreviewEmail(to, subject, html);
};
