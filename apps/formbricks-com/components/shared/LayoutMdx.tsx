import Footer from "./Footer";
import Header from "./Header";
import MetaInformation from "./MetaInformation";
import { Prose } from "./Prose";
import { useEffect } from "react";

const useExternalLinks = (selector: string) => {
  useEffect(() => {
    const links = document.querySelectorAll(selector);

    links.forEach((link) => {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    });

    return () => {
      links.forEach((link) => {
        link.removeAttribute("target");
        link.removeAttribute("rel");
      });
    };
  }, [selector]);
};

interface Props {
  meta: {
    title: string;
    description: string;
  };
  children: JSX.Element;
}

export default function LayoutMdx({ meta, children }: Props) {
  useExternalLinks(".prose a");
  return (
    <div className="flex h-screen flex-col justify-between">
      <MetaInformation title={meta.title} description={meta.description} />
      <Header />
      <main className="min-w-0 max-w-2xl flex-auto px-4 lg:max-w-none lg:pl-8 lg:pr-0 xl:px-16">
        <article className="mx-auto my-16 max-w-3xl px-2">
          {meta.title && (
            <header className="mb-9 space-y-1">
              {meta.title && (
                <h1 className="font-display text-3xl tracking-tight text-slate-800 dark:text-slate-100">
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
