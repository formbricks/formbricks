import formbricks from "@formbricks/js";
import { env } from "@formbricks/lib/env";

export const formbricksEnabled =
  typeof env.NEXT_PUBLIC_FORMBRICKS_API_HOST && env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID;

export const formbricksLogout = async () => {
  const loggedInWith = localStorage.getItem("loggedInWith");
  localStorage.clear();
  if (loggedInWith) {
    localStorage.setItem("loggedInWith", loggedInWith);
  }
  return await formbricks.logout();
};
