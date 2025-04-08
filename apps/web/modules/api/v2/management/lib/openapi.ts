import { env } from "@formbricks/lib/env";

export const managementServer = [
  {
    url: `${env.WEBAPP_URL}/api/v2/management`,
    description: "Formbricks Management API",
  },
];
