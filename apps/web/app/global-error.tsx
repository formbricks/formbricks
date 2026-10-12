"use client";

import NextError from "next/error";
import { useEffect } from "react";
import { reportBoundaryError } from "@/lib/sentry/boundary-error";

export default function GlobalError({ error }: Readonly<{ error: Error & { digest?: string } }>) {
  useEffect(() => {
    reportBoundaryError(error);
  }, [error]);
  return (
    <html lang="en-US">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
