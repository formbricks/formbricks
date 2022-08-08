import App, { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { ToastContainer } from "react-toastify";
import { usePosthog } from "../lib/posthog";
import "highlight.js/styles/tokyo-night-dark.css";
import "../styles/globals.css";
import "../styles/editorjs.css";
import "../styles/toastify.css";

function SnoopApp({
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

SnoopApp.getInitialProps = async (appContext) => {
  // calls page's `getInitialProps` and fills `appProps.pageProps`
  const appProps = await App.getInitialProps(appContext);

  return { ...appProps };
};

export default SnoopApp;
