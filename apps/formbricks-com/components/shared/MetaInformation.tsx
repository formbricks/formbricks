import Head from "next/head";

interface Props {
  title: string;
  description: string;
}

export default function MetaInformation({ title, description }: Props) {
  const pageTitle = `${title} | Open Source Forms & Surveys by Formbricks`;
  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`https://${process.env.VERCEL_URL}/social-image.png`} />
      <meta property="og:image:alt" content="Formbricks - Open Source Form and Survey Infrastructure" />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Open Source Forms and Surveys by Formbricks" />
    </Head>
  );
}
