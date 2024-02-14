import { Head, Html, Main, NextScript } from "next/document";

const themeScript = `
document.documentElement.classList.remove('dark');
`;

export default function Document() {
  return (
    <Html className="scroll-smooth antialiased [font-feature-settings:'ss01']" lang="en" dir="ltr">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />

        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
        <link rel="manifest" href="/favicon/site.webmanifest" />
        <link rel="mask-icon" href="/favicon/safari-pinned-tab.svg" color="#002941" />
        <link rel="shortcut icon" href="/favicon/favicon.ico" />
        <meta name="msapplication-TileColor" content="#002941" />
        <meta name="msapplication-config" content="/favicon/browserconfig.xml" />
        <meta name="theme-color" content="#ffffff" />
      </Head>
      <body className="bg-slate-50 dark:bg-slate-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
