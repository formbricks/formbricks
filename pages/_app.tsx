/* eslint-disable @next/next/inline-script-id */
import "highlight.js/styles/tokyo-night-dark.css";
import { SessionProvider } from "next-auth/react";
import { AppProps } from "next/app";
import { ToastContainer } from "react-toastify";
import "../styles/editorjs.css";
import "../styles/globals.css";
import "../styles/toastify.css";

function SnoopApp({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      <ToastContainer />
    </SessionProvider>
  );
}

export default SnoopApp;
