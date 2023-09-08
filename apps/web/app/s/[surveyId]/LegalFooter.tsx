import { env } from "@/env.mjs";
import Link from "next/link";

export default function LegalFooter() {
  if (!env.IMPRINT_URL && !env.PRIVACY_URL) return null;
  return (
    <div className="top-0 z-10 w-full border-b bg-white">
      <div className="mx-auto max-w-lg p-3 text-center text-sm text-slate-400">
        {env.IMPRINT_URL && (
          <Link href={env.IMPRINT_URL} target="_blank">
            Imprint
          </Link>
        )}
        {env.IMPRINT_URL && env.PRIVACY_URL && <span> | </span>}
        {env.PRIVACY_URL && (
          <Link href={env.PRIVACY_URL} target="_blank">
            Privacy Policy
          </Link>
        )}
      </div>
    </div>
  );
}
