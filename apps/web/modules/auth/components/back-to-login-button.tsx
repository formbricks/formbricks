import { Button } from "@/modules/ui/components/button";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export const BackToLoginButton = async () => {
  const t = await getTranslations();
  return (
    <Button variant="secondary" className="w-full justify-center">
      <Link href="/auth/login">{t("auth.signup.log_in")}</Link>
    </Button>
  );
};
