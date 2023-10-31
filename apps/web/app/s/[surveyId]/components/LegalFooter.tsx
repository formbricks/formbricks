import { IMPRINT_URL, PRIVACY_URL } from "@formbricks/lib/constants";
import Link from "next/link";

export default function LegalFooter() {
  if (!IMPRINT_URL && !PRIVACY_URL) return null;
  return (
    <div className="h-10 w-full border-t border-slate-200">
      <div className="mx-auto max-w-lg p-3 text-center text-sm text-slate-400">
        {IMPRINT_URL && (
          <Link href={IMPRINT_URL} target="_blank">
            Imprint
          </Link>
        )}
        {IMPRINT_URL && PRIVACY_URL && <span> | </span>}
        {PRIVACY_URL && (
          <Link href={PRIVACY_URL} target="_blank">
            Privacy Policy
          </Link>
        )}
      </div>
    </div>
  );
}
