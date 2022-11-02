import Head from "next/head";

import { Card } from "@/components/shared/Card";
import Layout from "@/components/shared/Layout";
import { getAllArticles } from "@/lib/articles";
import { formatDate } from "@/lib/utils";

function Article({ article }: any) {
  return (
    <article className="md:grid md:grid-cols-4 md:items-baseline">
      <Card className="md:col-span-3">
        <Card.Title href={`/blog/${article.slug}`}>{article.title}</Card.Title>
        <Card.Eyebrow as="time" dateTime={article.date} className="md:hidden" decorate>
          {formatDate(article.date)}
        </Card.Eyebrow>
        <Card.Description>{article.description}</Card.Description>
        <Card.Cta>Read article</Card.Cta>
      </Card>
      <Card.Eyebrow as="time" dateTime={article.date} className="mt-1 hidden md:block">
        {formatDate(article.date)}
      </Card.Eyebrow>
    </article>
  );
}

export default function ArticlesIndex({ articles }: any) {
  return (
    <>
      <Head>
        <title>Blog - Formbricks</title>
        <meta
          name="description"
          content="Blog articles around Formbricks, feature updates, the open source ecosystem and the future of forms."
        />
      </Head>
      <Layout
        meta={{
          title: "Blog",
        }}>
        <div className="my-20 md:border-l md:border-zinc-100 md:pl-6 md:dark:border-zinc-700/40">
          <div className="flex max-w-3xl flex-col space-y-16">
            {articles.map((article: any) => (
              <Article key={article.slug} article={article} />
            ))}
          </div>
        </div>
      </Layout>
    </>
  );
}

export async function getStaticProps() {
  return {
    props: {
      articles: (await getAllArticles()).map(({ component, ...meta }) => meta),
    },
  };
}
