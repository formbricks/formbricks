import { env } from "@/env.mjs";
import Link from "next/link";

export default function LegalFooter() {
  if (!env.NEXT_PUBLIC_IMPRINT_URL && !env.NEXT_PUBLIC_PRIVACY_URL) return null;
  return (
    <div className="h-10 w-full border-t border-slate-200">
      <div className="mx-auto max-w-lg p-3 text-center text-sm text-slate-400">
        {env.NEXT_PUBLIC_IMPRINT_URL && (
          <Link href={env.NEXT_PUBLIC_IMPRINT_URL} target="_blank">
            Imprint
          </Link>
        )}
        {env.NEXT_PUBLIC_IMPRINT_URL && env.NEXT_PUBLIC_PRIVACY_URL && <span> | </span>}
        {env.NEXT_PUBLIC_PRIVACY_URL && (
          <Link href={env.NEXT_PUBLIC_PRIVACY_URL} target="_blank">
            Privacy Policy
          </Link>
        )}
      </div>
    </div>
  );
}
