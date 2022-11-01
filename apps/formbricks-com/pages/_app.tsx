import "../styles/globals.css";
import type { AppProps } from "next/app";
import { Poppins } from "@next/font/google";
import clsx from "clsx";

const poppins = Poppins({
  weight: "400",
});

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
