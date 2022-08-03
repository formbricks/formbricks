import "../styles/globals.css";
import "../styles/editorjs.css";
import "../styles/toastify.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { ToastContainer } from "react-toastify";
import { usePosthog } from "../lib/posthog";

function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  usePosthog();
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      <ToastContainer />
    </SessionProvider>
  );
}

/* App.getInitialProps = async (appContext) => {
  // calls page's `getInitialProps` and fills `appProps.pageProps`
  const appProps = await App.getInitialProps(appContext);

  return { ...appProps };
}; */

export default App;
