import Head from "next/head";

interface Props {
  title: string;
  description: string;
}

export default function MetaInformation({ title, description }: Props) {
  return (
    <Head>
      <title>{title} - Formbricks - Open Source Form Infrastructure</title>
      <meta name="description" content={description} />
    </Head>
  );
}
