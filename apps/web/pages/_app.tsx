import "highlight.js/styles/tokyo-night-dark.css";
import { SessionProvider } from "next-auth/react";
import { ToastContainer } from "react-toastify";
import "../styles/editorjs.css";
import "ui/styles.css";
import "../styles/globals.css";
import "../styles/toastify.css";

function SnoopApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      <ToastContainer />
    </SessionProvider>
  );
}

export default SnoopApp;
