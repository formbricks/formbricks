import { Html, Head, Main, NextScript } from "next/document";
import TagManagerScript from "../components/TagManagerScript";

export default function Document() {
  return (
    <Html className="scroll-smooth">
      <Head>
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicons/favicon-kadea.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicons/favicon-kadea.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/favicons/favicon-kadea.png"
        />
        <link rel="manifest" href="/favicons/site.webmanifest" />
        <link
          rel="mask-icon"
          href="/favicons/safari-pinned-tab.svg"
          color="#5bbad5"
        />
        <meta name="theme-color" content="#0D0010" />
        <TagManagerScript />
      </Head>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5N2W64C"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          ></iframe>
        </noscript>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
