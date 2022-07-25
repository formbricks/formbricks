import Head from "next/head";
import { usePosthog } from "../../lib/posthog";

export default function BaseLayoutUnauthorized({ title, children }) {
  usePosthog(null, true);
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      {children}
    </>
  );
}
