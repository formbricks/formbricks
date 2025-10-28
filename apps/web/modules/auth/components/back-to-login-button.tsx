import Link from "next/link";
import { getTranslate } from "@/lingodotdev/server";
import { Button } from "@/modules/ui/components/button";

export const BackToLoginButton = async () => {
  const t = await getTranslate();
  return (
    <Button variant="secondary" className="w-full justify-center">
      <Link href="/auth/login" className="h-full w-full">
        {t("auth.signup.log_in")}
      </Link>
    </Button>
  );
};
