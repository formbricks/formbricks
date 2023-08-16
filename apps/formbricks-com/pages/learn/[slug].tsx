import LayoutMdx from "@/components/shared/LayoutMdx";
import { FAQPageJsonLd } from "next-seo";
import Image from "next/image";
import fetch from "node-fetch";
import ReactMarkdown from "react-markdown";

export async function getStaticPaths() {
  const response = await fetch(
    "http://127.0.0.1:1337/api/articles?populate[meta][populate]=*&filters[category][name][$eq]=learn"
  );
  const articles = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const paths = articles.data.map((article) => ({
    params: { slug: article.attributes.slug },
  }));

  return { paths, fallback: true };
}

export async function getStaticProps({ params }) {
  const res = await fetch(
    `http://127.0.0.1:1337/api/articles?populate[meta][populate]=*&populate[faq][populate]=*&filters[slug][$eq]=${params.slug}`
  );
  if (!res.ok) {
    throw new Error("Something went wrong");
  }
  const resData = await res.json();
  const article = resData.data[0];
  return { props: { article } };
}

export default function ArticlePage({ article = {} }) {
  if (!article || !article.attributes) return <div>Loading...</div>;

  // Use next/image to render images in markdown
  const renderers = {
    img: (image) => {
      return <Image src={image.src} alt={image.alt} width={1000} height={500} />;
    },
  };

  const {
    attributes: {
      author,
      publishedAt,
      text,
      faq,
      meta: {
        title,
        description,
        section,
        tags = [], // default empty array if tags are not provided
      } = {}, // default empty object if meta is not provided
    } = {}, // default empty object if attributes are not provided
  } = article;

  const metaTags = tags.map((tag) => tag.tag);

  const meta = {
    title,
    description,
    publishedTime: publishedAt,
    authors: [author],
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
        <ReactMarkdown components={renderers}>{text}</ReactMarkdown>
        <FAQPageJsonLd mainEntity={faqEntities} />
      </>
    </LayoutMdx>
  );
}
