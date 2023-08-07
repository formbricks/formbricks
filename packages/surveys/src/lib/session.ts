import { TSession } from "@formbricks/types/v1/sessions";

export const isExpired = (session: TSession): boolean => {
  if (!session) return true;
  return session.expiresAt < new Date();
};
