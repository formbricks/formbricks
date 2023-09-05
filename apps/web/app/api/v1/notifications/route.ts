import { responses } from "@/lib/api/response";
import { getNotifications } from "@formbricks/lib/services/notification";

// Management API for notifications
// GET /api/v1/notifications
// Parameters:
// - userId: string

export async function GET(request: Request) {
  // get surveyId from searchParams
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return responses.badRequestResponse("userId is required");
  }

  const notifications = await getNotifications(userId);

  return responses.successResponse(notifications);
}
