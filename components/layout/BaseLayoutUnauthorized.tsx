import Head from "next/head";

export default function BaseLayoutUnauthorized({ title, children }) {
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      {children}
    </>
  );
}
