import { Html, Head, Main, NextScript } from "next/document";

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
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
