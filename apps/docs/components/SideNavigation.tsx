import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string | null;
  level: number;
}

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

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setActiveId(id);
    }
  };

  if (headings.length) {
    return (
      <nav className={`fixed right-0 top-10 hidden h-full w-96 overflow-y-auto lg:mt-10 lg:block`}>
        <div className="'border-gray-700' border-l-2">
          <ul className="px-4 py-6">
            {headings.map((heading) => (
              <li
                key={heading.id}
                className={`mb-4 font-semibold text-slate-900 dark:text-white ${heading.id === activeId ? "rounded-r-md bg-slate-100 px-2 py-1 transition dark:bg-slate-800" : ""}`}>
                <a
                  href={`#${heading.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(heading.id);
                  }}
                  className={`font-semibold text-slate-900 dark:text-white`}>
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    );
  }

  return null;
};

export default SideNavigation;
