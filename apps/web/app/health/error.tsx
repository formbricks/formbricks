"use client";

import { XCircleIcon } from "lucide-react";

const Error = ({ error }: { error: Error & { digest?: string } }) => {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
      <XCircleIcon height={40} color="red" />
      <p className="text-md mt-4 font-bold text-zinc-900">Your Formbricks health is degraded</p>
      <p className="text-sm text-zinc-900">{error.message}</p>
    </div>
  );
};

export default Error;
