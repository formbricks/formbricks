import { getTranslations } from "next-intl/server";
import { Button } from "@formbricks/ui/components/Button";

export const BackToLoginButton = async () => {
  const t = await getTranslations();
  return (
    <Button size="base" variant="secondary" href="/auth/login" className="w-full justify-center">
      {t("auth.signup.log_in")}
    </Button>
  );
};
