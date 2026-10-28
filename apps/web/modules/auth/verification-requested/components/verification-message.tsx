"use client";

import { Trans } from "react-i18next";

interface VerificationMessageProps {
  email: string;
}

export const VerificationMessage = ({ email }: Readonly<VerificationMessageProps>) => {
  return (
    <p className="break-words text-slate-600">
      <Trans
        i18nKey="auth.verification-requested.verification_email_successfully_sent_info"
        values={{ email }}
        components={{ span: <span className="font-semibold" /> }}
      />
    </p>
  );
};
