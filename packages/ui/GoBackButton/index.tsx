"use client";

import { BackIcon } from "../icons";
import { useRouter } from "next/navigation";

export default function GoBackButton({ url }: { url?: string }) {
  const router = useRouter();
  return (
    <button
      className="inline-flex pt-5 text-sm text-slate-500"
      onClick={() => {
        if (url) {
          router.push(url);
          return;
        }
        router.back();
      }}>
      <BackIcon className="mr-2 h-5 w-5" />
      Back
    </button>
  );
}
