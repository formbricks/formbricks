"use client";

import { Trans } from "react-i18next";

interface VerificationMessageProps {
  email: string;
}

export const VerificationMessage = ({ email }: Readonly<VerificationMessageProps>) => {
  return (
    <p className="text-center text-sm break-words text-slate-700">
      <Trans
        i18nKey="auth.verification-requested.verification_email_successfully_sent_info"
        values={{ email }}
        components={{ span: <span className="font-semibold" /> }}
      />
    </p>
  );
};
