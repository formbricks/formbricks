import Layout from "./Layout";
import { Prose } from "./Prose";

interface Props {
  meta: any;
  children: JSX.Element;
}

export default function LayoutMdx({ meta, children }: Props) {
  return (
    <Layout meta={meta}>
      <article className="my-16">
        {meta.title && (
          <header className="mb-9 space-y-1">
            {meta.title && (
              <h1 className="font-display text-blue text-3xl tracking-tight dark:text-white">{meta.title}</h1>
            )}
          </header>
        )}
        <Prose>{children}</Prose>
      </article>
    </Layout>
  );
}
