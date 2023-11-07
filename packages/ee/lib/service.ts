import "server-only";

import { env } from "../../lib/env.mjs";
import { unstable_cache } from "next/cache";

// Enterprise License constant
export const ENTERPRISE_LICENSE_KEY = env.ENTERPRISE_LICENSE_KEY;

export const getIsEnterpriseEdition = () =>
  unstable_cache(
    async () => {
      if (ENTERPRISE_LICENSE_KEY) {
        return ENTERPRISE_LICENSE_KEY?.length > 0;
      }
      return false;
    },
    ["getIsEnterpriseEdition"],
    { revalidate: 60 * 60 * 24 }
  )();
