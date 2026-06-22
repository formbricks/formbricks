import { getSession } from "@/modules/auth/lib/session";

export const getSessionUser = async () => {
  const session = await getSession();
  return session?.user;
};
