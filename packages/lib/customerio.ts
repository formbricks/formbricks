import { TUser } from "@formbricks/types/user";

import { env } from "./env.mjs";

export const createCustomerIoCustomer = async (user: TUser) => {
  if (!env.CUSTOMER_IO_SITE_ID || !env.CUSTOMER_IO_API_KEY) {
    return;
  }
  try {
    const res = await fetch(`https://track-eu.customer.io/api/v1/customers/${user.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
      }),
    });
    if (res.status !== 200) {
      throw new Error(`Error sending user to CustomerIO: ${await res.text()}`);
    }
  } catch (error) {
    console.error('Error sending user to CustomerIO:', error.message);
    throw error;
  }
};
