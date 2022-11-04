import Head from "next/head";

interface Props {
  title: string;
  description: string;
}

export default function MetaInformation({ title, description }: Props) {
  const pageTitle = `${title} - Formbricks - Open Source Form Infrastructure`;
  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`https://${process.env.VERCEL_URL}/social-image.png`} />
      <meta property="og:image:alt" content="Formbricks - Open Source Form Infrastructure" />
    </Head>
  );
}
