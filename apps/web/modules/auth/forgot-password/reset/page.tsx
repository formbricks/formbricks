import Link from "next/link";
import { getTranslate } from "@/lingodotdev/server";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { ResetPasswordForm } from "@/modules/auth/forgot-password/reset/components/reset-password-form";
import {
  type TResetPasswordSearchParams,
  getResetPasswordToken,
} from "@/modules/auth/forgot-password/reset/lib/reset-link";
import { Button } from "@/modules/ui/components/button";

export const ResetPasswordPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<TResetPasswordSearchParams>;
}) => {
  const token = getResetPasswordToken(await searchParams);

  if (!token) {
    const t = await getTranslate();
    return (
      <FormWrapper>
        <div>
          <h1 className="mb-4 text-center leading-2 font-bold">{t("c.link_expired_heading")}</h1>
          <p className="text-center">{t("c.link_expired_description")}</p>
          <div className="mt-5 text-center">
            <Button variant="default" className="h-11 w-full justify-center sm:h-9" asChild>
              <Link href="/auth/forgot-password">{t("auth.forgot-password.reset_password")}</Link>
            </Button>
          </div>
        </div>
      </FormWrapper>
    );
  }

  return (
    <FormWrapper>
      <ResetPasswordForm />
    </FormWrapper>
  );
};
