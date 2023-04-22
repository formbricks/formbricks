import formbricks from "@formbricks/js";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import "../styles/globals.css";

declare const window: any;

if (typeof window !== "undefined") {
  if (process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID && process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST) {
    formbricks.init({
      environmentId: process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID,
      apiHost: process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST,
      logLevel: "debug",
    });
    window.formbricks = formbricks;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // Connect next.js router to Formbricks
    const handleRouteChange = formbricks?.registerRouteChange;
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, []);

  return <Component {...pageProps} />;
}
