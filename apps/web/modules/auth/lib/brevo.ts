import { BREVO_API_KEY, BREVO_LIST_ID } from "@/lib/constants";
import { validateInputs } from "@/lib/utils/validate";
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

    if (res.status !== 201) {
      const errorText = await res.text();
      logger.error({ errorText }, "Error sending user to Brevo");
    }
  } catch (error) {
    logger.error(error, "Error sending user to Brevo");
  }
};

export const updateBrevoCustomer = async ({ id, email }: { id: string; email: TUserEmail }) => {
  if (!BREVO_API_KEY) {
    return;
  }

  validateInputs([id, ZId], [email, ZUserEmail]);

  try {
    const requestBody: any = {
      attributes: {
        EMAIL: email,
      },
    };

    const res = await fetch(`https://api.brevo.com/v3/contacts/${id}?identifierType=ext_id`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (res.status !== 204) {
      const errorText = await res.text();
      logger.error({ errorText }, "Error updating user in Brevo");
    }
  } catch (error) {
    logger.error(error, "Error updating user in Brevo");
  }
};
