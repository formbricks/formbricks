import { unstable_cache } from "next/cache";
import "server-only";

import { ENTERPRISE_LICENSE_KEY } from "@formbricks/lib/constants";

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
