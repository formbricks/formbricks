import Link from "next/link";
import { getTranslate } from "@/lingodotdev/server";
import { Button } from "@/modules/ui/components/button";

/**
 * `callbackUrl` originates in a search param, so callers pass it through `resolveAuthCallbackUrl`
 * (origin-allowlisted against WEBAPP_URL) before it reaches this href. `/auth/login` validates it again
 * with the same helper before redirecting, so that is the layer that actually closes an open redirect —
 * validating here keeps the rendered link from advertising a target login would silently drop.
 * Omitted by every caller that has nothing to return the user to.
 */
export const BackToLoginButton = async ({ callbackUrl }: Readonly<{ callbackUrl?: string | null }>) => {
  const t = await getTranslate();
  const href = callbackUrl ? `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/auth/login";
  return (
    <Button variant="default" className="w-full justify-center">
      <Link href={href} className="h-full w-full">
        {t("auth.signup.log_in")}
      </Link>
    </Button>
  );
};
