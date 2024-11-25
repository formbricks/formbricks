import { ZId } from "@formbricks/types/common";
import { TUserEmail, ZUserEmail } from "@formbricks/types/user";
import { CUSTOMER_IO_API_KEY, CUSTOMER_IO_SITE_ID } from "./constants";
import { validateInputs } from "./utils/validate";

export const createCustomerIoCustomer = async ({ id, email }: { id: string; email: TUserEmail }) => {
  if (!CUSTOMER_IO_SITE_ID || !CUSTOMER_IO_API_KEY) {
    return;
  }

  validateInputs([id, ZId], [email, ZUserEmail]);

  try {
    const auth = Buffer.from(`${CUSTOMER_IO_SITE_ID}:${CUSTOMER_IO_API_KEY}`).toString("base64");
    const res = await fetch(`https://track-eu.customer.io/api/v1/customers/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        id: id,
        email: email,
      }),
    });
    if (res.status !== 200) {
      console.log("Error sending user to CustomerIO:", await res.text());
    }
  } catch (error) {
    console.log("error sending user to CustomerIO:", error);
  }
};
