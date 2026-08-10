"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";
import { IS_DEVELOPMENT_BUILD } from "@/lib/env-client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (IS_DEVELOPMENT_BUILD) {
      console.error(error.message);
    } else {
      Sentry.captureException(error);
    }
  }, [error]);
  return (
    <html lang="en-US">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
