import PlausibleProvider from "next-plausible";
import type { AppProps } from "next/app";
import { Jost } from "next/font/google";

import "../styles/globals.css";

const jost = Jost({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={jost.className}>
      <PlausibleProvider domain="formbricks.com" selfHosted={true}>
        <Component {...pageProps} />
      </PlausibleProvider>
    </div>
  );
}
