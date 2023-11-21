import Head from "next/head";

interface Props {
  title: string;
  description: string;
  publishedTime?: string;
  updatedTime?: string;
  authors?: string[];
  section?: string;
  tags?: string[];
}

export default function MetaInformation({
  title,
  description,
  publishedTime,
  updatedTime,
  authors,
  section,
  tags,
}: Props) {
  const pageTitle = `${title}`;
  const BASE_URL = `https://${process.env.VERCEL_URL}`;
  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta name="image" content={`https://${BASE_URL}/favicon.ico`} />
      <meta property="og:image" content={`https://${BASE_URL}/social-image.png`} />
      <link rel="icon" type="image/x-icon" href={`https://${BASE_URL}/favicon.ico`} />
      <link rel="canonical" href="https://formbricks.com/" />
      <meta name="msapplication-TileColor" content="#00C4B8" />
      <meta name="msapplication-TileImage" content={`https://${BASE_URL}/favicon.ico`} />
      <meta property="og:image:alt" content="Open Source Experience Management, Privacy-first" />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Formbricks Privacy-first Experience Management Solution" />
      <meta property="article:publisher" content="Formbricks GmbH" />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {updatedTime && <meta property="article:updated_time" content={updatedTime} />}
      {authors && <meta property="article:author" content={authors.join(", ")} />}
      {section && <meta property="article:section" content={section} />}
      {tags && <meta property="article:tag" content={tags.join(", ")} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@formbricks" />
      <meta name="twitter:creator" content="@formbricks" />
      <meta name="twitter:title" content="Formbricks | Privacy-first Experience Management" />
      <meta
        name="twitter:description"
        content="Build qualitative user research into your product. Leverage Best practices to increase Product-Market Fit."
      />
      <meta
        name="keywords"
        content="Formbricks, Privacy-first Experience Management, Create your survey, open-source typeform alternative, form with data insights"
      />
      <meta name="theme-color" content="#00C4B8" />
    </Head>
  );
}
