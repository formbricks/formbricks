"use client";

import { XCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const Error = ({ error }: { error: Error & { digest?: string } }) => {
  const t = useTranslations();
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
      <XCircleIcon height={40} color="red" />
      <p className="text-md mt-4 font-bold text-zinc-900">{t("health.degraded")}</p>
      <p className="text-sm text-zinc-900">{error.message}</p>
    </div>
  );
};

export default Error;
