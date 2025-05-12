import { sendEmail } from "@/modules/email";
import { FollowUpEmail } from "@/modules/survey/follow-ups/components/follow-up-email";
import { render } from "@react-email/components";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";

export const sendFollowUpEmail = async ({
  followUp,
  to,
  replyTo,
  survey,
  response,
  attachResponseData = false,
  logoUrl,
}: {
  followUp: TSurveyFollowUp;
  to: string;
  replyTo: string[];
  attachResponseData: boolean;
  survey: TSurvey;
  response: TResponse;
  logoUrl?: string;
}): Promise<void> => {
  const {
    action: {
      properties: { subject },
    },
  } = followUp;

  const emailHtmlBody = await render(
    await FollowUpEmail({
      followUp,
      logoUrl,
      attachResponseData,
      survey,
      response,
    })
  );

  await sendEmail({
    to,
    replyTo: replyTo.join(", "),
    subject,
    html: emailHtmlBody,
  });
};
