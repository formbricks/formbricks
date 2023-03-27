import type { AppProps } from "next/app";
import formbricks from "@formbricks/js";

import "@/styles/globals.css";

if (typeof window !== "undefined") {
  if (process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID && process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST) {
    formbricks.init({
      environmentId: process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
      apiHost: process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST,
      logLevel: "debug",
    });
  }
}

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
