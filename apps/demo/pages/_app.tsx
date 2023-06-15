import formbricks from "@formbricks/js";
import type { AppProps } from "next/app";
import Head from "next/head";
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
    formbricks.refresh();
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // Connect next.js router to Formbricks
    if (process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID && process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST) {
      const handleRouteChange = formbricks?.registerRouteChange;
      router.events.on("routeChangeComplete", handleRouteChange);

      return () => {
        router.events.off("routeChangeComplete", handleRouteChange);
      };
    }
  }, []);

  return (
    <>
      <Head>
        <title>Demo App</title>
      </Head>
      {(!process.env.NEXT_PUBLIC_FORMBRICKS_ENVIRONMENT_ID ||
        !process.env.NEXT_PUBLIC_FORMBRICKS_API_HOST) && (
        <div className="w-full bg-red-500 p-3 text-center text-sm text-white">
          Please set Formbricks environment variables in apps/demo/.env
        </div>
      )}
      <Component {...pageProps} />
    </>
  );
}
