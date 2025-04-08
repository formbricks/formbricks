import { env } from "@formbricks/lib/env";

export const organizationServer = [
  {
    url: `${env.WEBAPP_URL}/api/v2/organizations`,
    description: "Formbricks Organizations API",
  },
];
