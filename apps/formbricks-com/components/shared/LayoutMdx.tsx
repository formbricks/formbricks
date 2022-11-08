import Footer from "./Footer";
import Header from "./Header";
import Layout from "./Layout";
import MetaInformation from "./MetaInformation";
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
    <div className="flex h-screen flex-col justify-between">
      <MetaInformation title={meta.title} description={meta.description} />
      <Header />
      <main className="max-w-8xl relative mx-auto mb-auto flex flex-col justify-center px-8 xl:px-16">
        <article className="mx-auto my-16 max-w-3xl">
          {meta.title && (
            <header className="mb-9 space-y-1">
              {meta.title && (
                <h1 className="font-display text-blue text-3xl tracking-tight dark:text-white">
                  {meta.title}
                </h1>
              )}
            </header>
          )}
          <Prose className="">{children}</Prose>
        </article>
      </main>
      <Footer />
    </div>
  );
}
