import Head from "next/head";
import { Card } from "@/components/shared/Card";
import Layout from "@/components/shared/Layout";
import { getAllArticles } from "@/lib/articles";
import { formatDate } from "@/lib/utils";
import HeroTitle from "@/components/shared/HeroTitle";

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
      <Layout
        title="Blog"
        description="Articles around Formbricks, feature updates, the open source ecosystem and the future of form and survey software.">
        <HeroTitle headingPt1="What's" headingTeal="new?" />
        <div className="mx-auto mb-20 max-w-3xl px-4 md:border-l md:border-slate-100 md:pl-6 md:dark:border-slate-800">
          <div className="flex flex-col space-y-16 px-4">
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
