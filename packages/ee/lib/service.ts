import "server-only";

import { ENTERPRISE_LICENSE_KEY } from "@formbricks/lib/constants";
import { unstable_cache } from "next/cache";

export const getIsEnterpriseEdition = () =>
  unstable_cache(
    async () => {
      if (ENTERPRISE_LICENSE_KEY) {
        return ENTERPRISE_LICENSE_KEY?.length > 0;
      }
      return true;
    },
    ["getIsEnterpriseEdition"],
    { revalidate: 60 * 60 * 24 }
  )();
