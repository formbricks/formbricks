import { usePlausible } from "next-plausible";
import { useRouter } from "next/router";

import { Button } from "@formbricks/ui/Button";

export default function SalesCTA() {
  const plausible = usePlausible();
  const router = useRouter();
  return (
    <Button
      variant="darkCTA"
      className="w-fit"
      onClick={() => {
        router.push("https://app.formbricks.com/auth/signup");
        plausible("SalesPage_CTA_GetStartedNow");
      }}>
      Get started now
    </Button>
  );
}
