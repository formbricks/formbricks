import formbricks from "@formbricks/js/app";
import { env } from "@formbricks/lib/env";

export const formbricksEnabled =
  typeof env.NEXT_PUBLIC_FORMBRICKS_API_HOST && env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID;

export const formbricksLogout = async () => {
  localStorage.clear();
  return await formbricks.logout();
};
