import { Analytics } from "@vercel/analytics/react";
import { SessionProvider } from "next-auth/react";
import { ToastContainer } from "react-toastify";
import { FeedbackButton } from "@/components/FeedbackButton";
import "@/styles/globals.css";
import "@/styles/toastify.css";
import "@/styles/prism.css";

function FormbricksApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      <ToastContainer />
      <Analytics />
      <FeedbackButton />
    </SessionProvider>
  );
}

export default FormbricksApp;
