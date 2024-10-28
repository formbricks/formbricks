import { FormWrapper } from "@/app/(auth)/auth/components/FormWrapper";
import { RequestVerificationEmail } from "@/app/(auth)/auth/verification-requested/components/RequestVerificationEmail";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

const VerificationPageSchema = z.string().email();

const Page = async ({ searchParams }) => {
  const t = await getTranslations();
  const email = searchParams.email;
  try {
    const parsedEmail = VerificationPageSchema.parse(email).toLowerCase();
    return (
      <FormWrapper>
        <>
          <h1 className="leading-2 mb-4 text-center text-lg font-semibold text-slate-900">
            {t("auth.verification-requested.please_confirm_your_email_address")}
          </h1>
          <p className="text-center text-sm text-slate-700">
            {t("auth.verification-requested.we_sent_an_email_to")}{" "}
            <span className="font-semibold italic">{parsedEmail}</span>.{" "}
            {t("auth.verification-requested.please_click_the_link_in_the_email_to_activate_your_account")}
          </p>
          <hr className="my-4" />
          <p className="text-center text-xs text-slate-500">
            {t("auth.verification-requested.you_didnt_receive_an_email_or_your_link_expired")}
          </p>
          <div className="mt-5">
            <RequestVerificationEmail email={parsedEmail} />
          </div>
        </>
      </FormWrapper>
    );
  } catch (error) {
    return (
      <FormWrapper>
        <p className="text-center">{t("auth.verification-requested.invalid_email_address")}</p>
      </FormWrapper>
    );
  }
};

export default Page;
