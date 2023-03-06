"use client";

import { TailSpin } from "react-loader-spinner";

export default function LoadingSpinner() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <TailSpin color="#1f2937" height={30} width={30} />
    </div>
  );
}
