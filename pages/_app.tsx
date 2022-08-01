import "../styles/globals.css";
import "../styles/editorjs.css";
import "../styles/toastify.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { ToastContainer } from "react-toastify";
import { usePosthog } from "../lib/posthog";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  usePosthog();
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      <ToastContainer />
    </SessionProvider>
  );
}
