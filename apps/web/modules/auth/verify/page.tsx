import { cookies } from "next/headers";
import { WEBAPP_URL } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { getAuthCallbackUrlFromCookies, resolveAuthCallbackUrl } from "@/modules/auth/lib/callback-url";
import { SignIn } from "@/modules/auth/verify/components/sign-in";

export const VerifyPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; callbackUrl?: string | string[] }>;
}) => {
  const t = await getTranslate();
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const { token, callbackUrl } = params;
  const resolvedCallbackUrl =
    resolveAuthCallbackUrl({
      searchParamCallbackUrl: callbackUrl,
      cookieCallbackUrl: getAuthCallbackUrlFromCookies(cookieStore),
      allowCookieFallback: true,
      webAppUrl: WEBAPP_URL,
    }) ?? WEBAPP_URL;

  return token ? (
    <FormWrapper>
      <p className="text-center">{t("auth.verify.verifying")}</p>
      <SignIn token={token} callbackUrl={resolvedCallbackUrl} />
    </FormWrapper>
  ) : (
    <p className="text-center">{t("auth.verify.no_token_provided")}</p>
  );
};
