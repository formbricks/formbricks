import { useEffect, useState } from "react";

type Heading = {
  id: string;
  text: string | null;
  level: number;
};

const SideNavigation = ({ pathname }) => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const getHeadings = () => {
      const headingElements = document.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]");
      const headings: Heading[] = Array.from(headingElements).map((heading) => ({
        id: heading.id,
        text: heading.textContent,
        level: parseInt(heading.tagName.slice(1)),
      }));

      setHeadings(headings);
    };

    getHeadings();
  }, [pathname]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setActiveId(id);
    }
  };

  if (headings.length) {
    return (
      <aside className="fixed right-0 top-10 z-50 hidden h-full w-72 overflow-hidden overflow-y-auto pt-14 lg:mt-10 lg:block">
        <div className="border-l-2 border-gray-700">
          <h3 className="ml-2 mt-1">On this page</h3>
          <ul className="px-5 py-5">
            {headings.map((heading) => (
              <li
                key={heading.id}
                className={`mb-4 text-slate-900 dark:text-white ${
                  heading.id === activeId
                    ? "rounded-r-md bg-slate-100 px-2 py-1 transition dark:bg-slate-800"
                    : ""
                }`}>
                <a
                  href={`#${heading.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(heading.id);
                  }}
                  className="font-semibold text-slate-900 dark:text-white">
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    );
  }

  return null;
};

export default SideNavigation;
