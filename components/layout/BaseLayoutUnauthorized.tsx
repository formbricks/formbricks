import Head from "next/head";
import BaseLayoutManagement from "./BaseLayoutManagement";

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
