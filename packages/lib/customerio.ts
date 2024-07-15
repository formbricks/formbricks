import { TUser } from "@formbricks/types/user";
import { CUSTOMER_IO_API_KEY, CUSTOMER_IO_SITE_ID } from "./constants";

export const createCustomerIoCustomer = async (user: TUser) => {
  if (!CUSTOMER_IO_SITE_ID || !CUSTOMER_IO_API_KEY) {
    return;
  }
  try {
    const auth = Buffer.from(`${CUSTOMER_IO_SITE_ID}:${CUSTOMER_IO_API_KEY}`).toString("base64");
    const res = await fetch(`https://track-eu.customer.io/api/v1/customers/${user.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
      }),
    });
    if (res.status !== 200) {
      console.log("Error sending user to CustomerIO:", await res.text());
    }
  } catch (error) {
    console.log("error sending user to CustomerIO:", error);
  }
};
