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
      <article className="mx-auto my-16 max-w-3xl">
        {meta.title && (
          <header className="mb-9 space-y-1">
            {meta.title && (
              <h1 className="font-display text-blue text-3xl tracking-tight dark:text-white">{meta.title}</h1>
            )}
          </header>
        )}
        <Prose className="">{children}</Prose>
      </article>
    </Layout>
  );
}
