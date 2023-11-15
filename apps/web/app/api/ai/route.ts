import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { responses } from "@/app/lib/api/response";
import { getOpenTextInsights } from "@formbricks/ee/ai/lib/openTextInsights";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return responses.unauthorizedResponse();
  }

  const { messages, surveyId, questionId } = await request.json();
  const intent = messages[messages.length - 1].content;

  try {
    switch (intent) {
      case "openTextInsights":
        const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
        if (!isAuthorized) {
          return responses.unauthorizedResponse();
        }

        const answer = await getOpenTextInsights(surveyId, questionId);
        return answer;

      default:
        return responses.notFoundResponse("intent", intent, true);
    }
  } catch (err) {
    return responses.internalServerErrorResponse(`Failed to get data from AI due to ${err}`, true);
  }
}
