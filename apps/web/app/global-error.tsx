"use client";

// import * as Sentry from "@sentry/nextjs";
// import NextError from "next/error";
// import { useEffect } from "react";

// export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
export default function GlobalError() {
  // useEffect(() => {
  //   if (process.env.NODE_ENV === "development") {
  //     console.error(error.message);
  //   } else {
  //     Sentry.captureException(error);
  //   }
  // }, [error]);
  return (
    <html>
      <body>{/* <NextError statusCode={0} /> */}</body>
    </html>
  );
}
