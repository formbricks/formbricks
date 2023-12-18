import Link from "next/link";

import { IMPRINT_URL, PRIVACY_URL } from "@formbricks/lib/constants";

interface LegalFooterProps {
  bgColor?: string | null;
}

export default function LegalFooter({ bgColor }: LegalFooterProps) {
  if (!IMPRINT_URL && !PRIVACY_URL) return null;

  return (
    <div
      className={`fixed bottom-0 h-12 w-full`}
      style={{
        backgroundColor: `${bgColor}`,
      }}>
      <div className="mx-auto max-w-lg p-3 text-center text-xs text-slate-400">
        {IMPRINT_URL && (
          <Link href={IMPRINT_URL} target="_blank" className="hover:underline">
            Imprint
          </Link>
        )}
        {IMPRINT_URL && PRIVACY_URL && <span className="px-2">|</span>}
        {PRIVACY_URL && (
          <Link href={PRIVACY_URL} target="_blank" className="hover:underline">
            Privacy Policy
          </Link>
        )}
      </div>
    </div>
  );
}
