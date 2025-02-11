import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { prisma } from "@formbricks/database";
import { displayCache } from "@formbricks/lib/display/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const deleteDisplay = async (displayId: string): Promise<Result<boolean, ApiErrorResponse>> => {
  try {
    const display = await prisma.display.delete({
      where: {
        id: displayId,
      },
      select: {
        id: true,
        contactId: true,
        surveyId: true,
      },
    });

    if (!display) {
      return err({ type: "not_found", details: [{ field: "display", issue: "not found" }] });
    }

    displayCache.revalidate({
      id: display.id,
      contactId: display.contactId,
      surveyId: display.surveyId,
    });

    return ok(true);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "display", issue: error.message }],
    });
  }
};
