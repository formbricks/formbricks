import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";

export const getResponse = reactCache(async (contactId: string, surveyId: string) => {
  try {
    const response = await prisma.response.findFirst({
      where: {
        contactId,
        surveyId,
      },
      select: {
        id: true,
      },
    });

    if (!response) {
      return err({ type: "not_found", details: [{ field: "response", issue: "not found" }] });
    }

    return ok(response);
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "response", issue: error.message }] });
  }
});
