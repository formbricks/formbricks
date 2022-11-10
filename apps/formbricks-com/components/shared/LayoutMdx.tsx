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
    <div className="flex flex-col justify-between h-screen">
      <MetaInformation title={meta.title} description={meta.description} />
      <Header />
      <main className="flex-auto max-w-2xl min-w-0 px-4 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
        <article className="max-w-3xl mx-auto my-16">
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
      </main>
      <Footer />
    </div>
  );
}
