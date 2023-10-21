import PlausibleProvider from "next-plausible";
import type { AppProps } from "next/app";
import { Jost } from "next/font/google";
import "../styles/globals.css";

const jost = Jost({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-jost",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PlausibleProvider domain="formbricks.com" selfHosted={true}>
      <div className={`${jost.variable}`}>
        <Component {...pageProps} />
      </div>
    </PlausibleProvider>
  );
}
