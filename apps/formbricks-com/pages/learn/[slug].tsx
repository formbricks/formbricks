import LayoutMdx from "@/components/shared/LayoutMdx";
import { FAQPageJsonLd } from "next-seo";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import fetch from "node-fetch";
import ReactMarkdown from "react-markdown";

type Article = {
  id?: number;
  attributes?: {
    author?: string;
    title?: string;
    text?: string;
    slug?: string;
    createdAt?: string;
    updatedAt?: string;
    publishedAt?: string;
    meta?: {
      id?: number;
      description?: string;
      title?: string;
      publisher?: string;
      section?: string;
      tags?: {
        id?: number;
        tag?: string;
      }[];
    };
    faq?: {
      id?: number;
      question?: string;
      answer?: string;
    }[];
  };
};

type ArticlePageProps = {
  article?: Article;
};

interface ArticleResponse {
  data: Article[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export async function getStaticPaths() {
  if (!process.env.STRAPI_API_KEY) {
    return { paths: [], fallback: true };
  }
  const response = await fetch(
    "https://strapi.formbricks.com/api/articles?populate[meta][populate]=*&filters[category][name][$eq]=learn",
    {
      headers: {
        Authorization: `Bearer ${process.env.STRAPI_API_KEY}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const articles = (await response.json()) as ArticleResponse;

  const paths = articles.data.map((article) => ({
    params: { slug: article.attributes?.slug },
  }));

  return { paths, fallback: true };
}

export async function getStaticProps({ params }) {
  if (!process.env.STRAPI_API_KEY) {
    return { props: { article: null } };
  }
  const res = await fetch(
    `https://strapi.formbricks.com/api/articles?populate[meta][populate]=*&populate[faq][populate]=*&filters[slug][$eq]=${params.slug}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.STRAPI_API_KEY}`,
      },
    }
  );
  if (!res.ok) {
    throw new Error("Something went wrong");
  }
  const resData = (await res.json()) as ArticleResponse;
  const article = resData.data[0];
  return { props: { article } };
}

export default function ArticlePage({ article = {} }: ArticlePageProps) {
  const router = useRouter();
  if (!article || !article.attributes) return <div>Loading...</div>;

  // Generate canonical URL
  const canonicalURL = `https://formbricks.com${router.asPath}`;

  // Use next/image to render images in markdown
  const renderers = {
    img: (image) => {
      return <Image src={image.src} alt={image.alt} width={1000} height={500} className="rounded-lg" />;
    },
  };

  const {
    attributes: {
      author,
      publishedAt,
      text,
      faq = [],
      meta: {
        title = "",
        description = "",
        section = "",
        tags = [], // default empty array if tags are not provided
      } = {}, // default empty object if meta is not provided
    } = {}, // default empty object if attributes are not provided
  } = article;

  const metaTags = tags.map((tag) => tag.tag || "").filter((t) => t !== "");

  const meta = {
    title,
    description,
    publishedTime: publishedAt || Date.now().toString(),
    authors: [author || "Formbricks"],
    section,
    tags: metaTags,
  };

  // Convert the FAQ details into the desired format for FAQPageJsonLd
  const faqEntities = faq.map(({ question, answer }) => ({
    questionName: question,
    acceptedAnswerText: answer,
  }));

  return (
    <LayoutMdx meta={meta}>
      <>
        <ReactMarkdown components={renderers}>{text as any}</ReactMarkdown>
        <Head>
          <link rel="canonical" href={canonicalURL} />
        </Head>
        <FAQPageJsonLd mainEntity={faqEntities} />
      </>
    </LayoutMdx>
  );
}
