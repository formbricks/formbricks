import Link from "next/link";

export default function LegalFooter() {
  return (
    <div className="top-0 z-10 w-full border-b bg-white">
      <div className="mx-auto max-w-lg p-3 text-center text-sm text-slate-400">
        {process.env.NEXT_PUBLIC_IMPRINT_URL && (
          <Link href={process.env.NEXT_PUBLIC_IMPRINT_URL} target="_blank">
            Imprint
          </Link>
        )}
        {process.env.NEXT_PUBLIC_IMPRINT_URL && process.env.NEXT_PUBLIC_PRIVACY_URL && <span> | </span>}
        {process.env.NEXT_PUBLIC_PRIVACY_URL && (
          <Link href={process.env.NEXT_PUBLIC_PRIVACY_URL} target="_blank">
            Privacy Policy
          </Link>
        )}
      </div>
    </div>
  );
}
