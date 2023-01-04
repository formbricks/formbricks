import type { AppProps } from "next/app";
import PlausibleProvider from "next-plausible";
import "../styles/globals.css";
import Script from "next/script";

declare global {
  interface Window {
    formbricks: any;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PlausibleProvider domain="formbricks.com" selfHosted={true}>
      <Script src="https://unpkg.com/@formbricks/feedback@0.1.2" defer />
      <Script id="feedback-setup">{`
      window.formbricks = {
      config: {
        hqUrl: "https://xm.formbricks.com",
        formId: "clchup08o0000lj08526vdujt",
        contact: {
          name: "Matti",
          position: "Co-Founder",
          imgUrl: "https://avatars.githubusercontent.com/u/675065?s=128&v=4",
        },
      },
      ...window.formbricks,
    };`}</Script>
      <button
        className="bg-brand fixed top-1/2 -right-8 z-40 hidden -translate-y-1/2 -rotate-90 rounded p-4 font-medium text-white sm:block"
        onClick={(event) => window.formbricks.open(event)}>
        Feedback
      </button>
      <Component {...pageProps} />
    </PlausibleProvider>
  );
}
