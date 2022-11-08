import Layout from "./Layout";
import { Prose } from "./Prose";

interface Props {
  meta: {
    title: string;
    description: string;
  };
  children: JSX.Element;
}

export default function LayoutMdx({ meta, children }: Props) {
  return (
    <Layout title={meta.title} description={meta.description}>
      <article className="max-w-3xl px-2 mx-auto my-16">
        {meta.title && (
          <header className="space-y-1 mb-9">
            {meta.title && (
              <h1 className="text-3xl tracking-tight font-display text-blue dark:text-gray-100">
                {meta.title}
              </h1>
            )}
          </header>
        )}
        <Prose className="">{children}</Prose>
      </article>
    </Layout>
  );
}
