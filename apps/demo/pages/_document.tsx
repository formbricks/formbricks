import { Head, Html, Main, NextScript } from "next/document";

export default function Document(): React.JSX.Element {
  return (
    <Html lang="en" className="h-full bg-slate-50">
      <Head />
      <body className="h-full">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
