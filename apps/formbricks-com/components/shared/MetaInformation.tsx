import Head from "next/head";

interface Props {
  title: string;
  description: string;
  publishedTime?: string;
  authors?: string[];
  section?: string;
  tags?: string[];
}

export default function MetaInformation({
  title,
  description,
  publishedTime,
  authors,
  section,
  tags,
}: Props) {
  const pageTitle = `${title} | Open-Source Experience Management, Privacy-first`;
  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`https://${process.env.VERCEL_URL}/social-image.png`} />
      <meta property="og:image:alt" content="Formbricks - Open Source Experience Management, Privacy-first" />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Open Source Experience Management, Privacy-first" />
      <meta property="article:publisher" content="Formbricks" />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {authors && <meta property="article:author" content={authors.join(", ")} />}
      {section && <meta property="article:section" content={section} />}
      {tags && <meta property="article:tag" content={tags.join(", ")} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@formbricks" />
      <meta name="twitter:creator" content="@formbricks" />
      <meta name="theme-color" content="#00C4B8" />
    </Head>
  );
}
