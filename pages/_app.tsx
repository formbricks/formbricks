/* eslint-disable @next/next/inline-script-id */
import "highlight.js/styles/tokyo-night-dark.css";
import { SessionProvider } from "next-auth/react";
import { AppProps } from "next/app";
import Script from "next/script";
import { ToastContainer } from "react-toastify";
import "../styles/editorjs.css";
import "../styles/globals.css";
import "../styles/toastify.css";

function SnoopApp({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <>
      <Script
        strategy='lazyOnload'
        src={`https://www.googletagmanager.com/gtag/js?id=${process.env.GOOGLE_TAG_MANAGER_ID})`}
      ></Script>

      <Script strategy='lazyOnload'>
        {`window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', ${process.env.GOOGLE_TAG_MANAGER_ID});`}
      </Script>

      <SessionProvider session={session}>
        <Component {...pageProps} />
        <ToastContainer />
      </SessionProvider>
    </>
  );
}

export default SnoopApp;
