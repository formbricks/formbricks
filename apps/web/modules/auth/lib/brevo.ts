import { BREVO_API_KEY, BREVO_LIST_ID } from "@formbricks/lib/constants";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { TUserEmail, ZUserEmail } from "@formbricks/types/user";

export const createBrevoCustomer = async ({ id, email }: { id: string; email: TUserEmail }) => {
  if (!BREVO_API_KEY) {
    return;
  }

  validateInputs([id, ZId], [email, ZUserEmail]);

  try {
    const requestBody: any = {
      email,
      ext_id: id,
      updateEnabled: false,
    };

    // Add `listIds` only if `BREVO_LIST_ID` is defined
    const listId = BREVO_LIST_ID ? parseInt(BREVO_LIST_ID, 10) : null;
    if (listId && !Number.isNaN(listId)) {
      requestBody.listIds = [listId];
    }

    const res = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (res.status !== 200) {
      logger.error(await res.text(), "Error sending user to Brevo");
    }
  } catch (error) {
    logger.error(error, "Error sending user to Brevo");
  }
};
