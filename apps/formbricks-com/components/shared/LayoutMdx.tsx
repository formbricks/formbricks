import Layout from "./Layout";
import { Prose } from "./Prose";

interface Props {
  meta: any;
  children: JSX.Element;
}

export default function LayoutMdx({ meta, children }: Props) {
  return (
    <Layout meta={meta}>
      <article className="max-w-3xl mx-auto my-16">
        {meta.title && (
          <header className="space-y-1 mb-9">
            {meta.title && (
              <h1 className="text-3xl tracking-tight font-display text-blue dark:text-white">{meta.title}</h1>
            )}
          </header>
        )}
        <Prose className="">{children}</Prose>
      </article>
    </Layout>
  );
}
