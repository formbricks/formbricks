import Link from "next/link";
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
      const headingElements = document.querySelectorAll("h2[id], h3[id], h4[id]");
      const headings: Heading[] = Array.from(headingElements).map((heading) => ({
        id: heading.id,
        text: heading.textContent,
        level: parseInt(heading.tagName.slice(1)),
      }));

      setHeadings(headings);
    };

    getHeadings();
  }, [pathname]);

  const renderHeading = (items: Heading[], currentLevel: number) => (
    <ul className="ml-1 mt-4">
      {items.map((heading, index) => {
        if (heading.level === currentLevel) {
          let nextIndex = index + 1;
          while (nextIndex < items.length && items[nextIndex].level > currentLevel) {
            nextIndex++;
          }

          return (
            <li
              key={heading.text}
              className={`mb-4 ml-4 text-slate-900 dark:text-white  ml-${heading.level === 2 ? 0 : heading.level === 3 ? 4 : 6}`}>
              <Link
                href={`#${heading.id}`}
                onClick={() => setActiveId(heading.id)}
                className={`font-normal text-slate-900 dark:text-white ${
                  heading.id === activeId
                    ? "rounded-r-md font-semibold text-blue-800 transition dark:text-amber-300"
                    : ""
                }`}>
                {heading.text}
              </Link>
              {nextIndex > index + 1 && renderHeading(items.slice(index + 1, nextIndex), currentLevel + 1)}
            </li>
          );
        }
        return null;
      })}
    </ul>
  );

  if (headings.length) {
    return (
      <aside className="fixed right-0 top-0 hidden h-[calc(100%-2.5rem)] w-80 overflow-hidden overflow-y-auto pt-16 lg:mt-10 lg:block">
        <div className="border-l-2 border-gray-700">
          <h3 className="ml-2 mt-1">On this page</h3>
          {renderHeading(headings, 2)}
        </div>
      </aside>
    );
  }

  return null;
};

export default SideNavigation;
